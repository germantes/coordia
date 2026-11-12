import React, { type FormEvent, useState } from 'react';
import LocationPicker, { type Coordinates } from './LocationPicker.js';

import Account from './Account.js';
import { Session, SessionExpired } from './session.js';

const categories = [
  ['infrastructure', 'Infraestructura'],
  ['safety', 'Seguridad'],
  ['accessibility', 'Accesibilidad'],
  ['environment', 'Medio ambiente'],
  ['other', 'Otro'],
] as const;

interface ApiError {
  error?: string;
  fields?: Record<string, string>;
}

interface LocationObservation extends Coordinates {
  accuracyMeters: number;
  capturedAt: string;
}

interface NearbyReport {
  id: string | number;
  category: string;
  description: string;
  createdAt: string;
  distanceMeters: number;
  response: 'confirm' | 'question' | null;
  counts: { confirm: number; question: number };
}

function getLocationObservation(): Promise<LocationObservation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        capturedAt: new Date(timestamp).toISOString(),
      }),
      () => reject(new Error('No se pudo obtener tu ubicación. Revisa los permisos e inténtalo de nuevo.')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  });
}

function getResponseError(body: ApiError, status: number): string {
  if (status === 401) return 'Inicia sesión para responder a reportes.';
  if (status === 403) return body.error ?? 'No tienes acceso a este reporte o no tienes un organismo asignado.';
  if (status === 409) return body.error ?? 'Este reporte ya no acepta respuestas.';
  if (status === 422) return body.error ?? 'Tu ubicación no cumple los requisitos de proximidad.';
  return body.error ?? 'No se pudo completar la operación. Inténtalo de nuevo.';
}

function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function Reports({ session, onExpire }: { session: Session; onExpire: () => void }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [success, setSuccess] = useState<{ id: string | number; status: string } | null>(null);
  const [nearbyReports, setNearbyReports] = useState<NearbyReport[]>([]);
  const [nearbyLoaded, setNearbyLoaded] = useState(false);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [activeResponseReportId, setActiveResponseReportId] = useState<string | number | null>(null);
  const [nearbyError, setNearbyError] = useState('');

  async function loadNearbyReports() {
    setNearbyBusy(true);
    setNearbyError('');
    try {
      const currentLocation = await getLocationObservation();
      const response = await session.request('/api/reports/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: currentLocation }),
      });
      const body = await response.json() as ApiError & { reports?: NearbyReport[] };
      if (!response.ok) throw new Error(getResponseError(body, response.status));
      setNearbyReports(body.reports ?? []);
      setNearbyLoaded(true);
    } catch (error) {
      if (error instanceof SessionExpired) return onExpire();
      setNearbyError(error instanceof Error ? error.message : 'No se pudieron cargar los reportes cercanos.');
    } finally {
      setNearbyBusy(false);
    }
  }

  async function answerReport(reportId: string | number, answer: 'confirm' | 'question') {
    setActiveResponseReportId(reportId);
    setNearbyError('');
    try {
      const currentLocation = await getLocationObservation();
      const response = await session.request(`/api/reports/${encodeURIComponent(reportId)}/response`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: answer, location: currentLocation }),
      });
      const body = await response.json() as ApiError & {
        response?: 'confirm' | 'question';
        counts?: NearbyReport['counts'];
      };
      if (!response.ok) throw new Error(getResponseError(body, response.status));
      setNearbyReports((reports) => reports.map((report) => report.id === reportId
        ? { ...report, response: body.response ?? answer, counts: body.counts ?? report.counts }
        : report));
    } catch (error) {
      if (error instanceof SessionExpired) return onExpire();
      setNearbyError(error instanceof Error ? error.message : 'No se pudo guardar tu respuesta.');
    } finally {
      setActiveResponseReportId(null);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setFormError('Este navegador no permite obtener la ubicación. Selecciona el punto directamente en el mapa.');
      return;
    }
    setLocating(true);
    setFormError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      () => {
        setFormError('No se pudo obtener tu ubicación. Comprueba los permisos o selecciona el punto en el mapa.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFields({});
    setFormError('');
    setSuccess(null);

    const clientErrors: Record<string, string> = {};
    if (!category) clientErrors.category = 'Selecciona una categoría.';
    if (description.trim().length < 10 || description.trim().length > 2_000) {
      clientErrors.description = 'Escribe entre 10 y 2.000 caracteres.';
    }
    if (!location) clientErrors.location = 'Selecciona la ubicación en el mapa.';
    if (occurredAt && new Date(occurredAt).getTime() > Date.now()) {
      clientErrors.occurredAt = 'La fecha del incidente no puede estar en el futuro.';
    }
    if (Object.keys(clientErrors).length) {
      setFields(clientErrors);
      return;
    }

    const payload = {
      category,
      description,
      location,
      ...(occurredAt ? { occurredAt: localDateTimeToIso(occurredAt) } : {}),
    };

    setBusy(true);
    try {
      const response = await session.request('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as ApiError & { id?: string | number; status?: string };
      if (!response.ok) {
        if (body.fields) setFields(body.fields);
        setFormError(body.error ?? 'No se pudo enviar el reporte. Inténtalo de nuevo.');
        return;
      }
      setSuccess({ id: body.id ?? '—', status: body.status ?? 'pending' });
      setCategory('');
      setDescription('');
      setOccurredAt('');
      setLocation(null);
    } catch (error) {
      if (error instanceof SessionExpired) return onExpire();
      setFormError('No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
        <div className="intro">
          <p className="eyebrow">INCIDENCIAS EN TU ENTORNO</p>
          <h1>Comunica un incidente</h1>
          <p className="intro-copy">Cuéntanos qué sucede y dónde. La ubicación se utilizará para gestionar el reporte.</p>
        </div>

        {success && (
          <div className="success-banner" role="status">
            <span className="success-icon" aria-hidden="true">✓</span>
            <div><strong>Reporte enviado</strong><p>Referencia {success.id} · Estado: {success.status}</p></div>
          </div>
        )}

        <form className="report-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="category">Categoría <span aria-hidden="true">*</span></label>
            <select id="category" value={category} onChange={(event) => setCategory(event.target.value)} aria-invalid={Boolean(fields.category)} aria-describedby={fields.category ? 'category-error' : undefined}>
              <option value="">Selecciona una categoría</option>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {fields.category && <p className="field-error" id="category-error">{fields.category}</p>}
          </div>

          <div className="field">
            <div className="label-row"><label htmlFor="description">Descripción <span aria-hidden="true">*</span></label><span className="counter">{description.length}/2000</span></div>
            <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe qué ocurre y cualquier detalle útil para localizarlo…" rows={5} maxLength={2_000} aria-invalid={Boolean(fields.description)} aria-describedby={fields.description ? 'description-error' : 'description-help'} />
            {fields.description ? <p className="field-error" id="description-error">{fields.description}</p> : <p className="field-help" id="description-help">Entre 10 y 2.000 caracteres. No incluyas datos personales innecesarios.</p>}
          </div>

          <div className="field">
            <div className="label-row"><label htmlFor="map">Ubicación <span aria-hidden="true">*</span></label><button type="button" className="location-button" onClick={locateMe} disabled={locating}>{locating ? 'Localizando…' : '◎ Usar mi ubicación'}</button></div>
            <p className="field-help map-help">Pulsa en el mapa para señalar el punto del incidente.</p>
            <div id="map" className={`map-frame${fields.location ? ' map-invalid' : ''}`}>
              <LocationPicker value={location} onChange={setLocation} />
            </div>
            {location && <p className="coordinates">Punto seleccionado: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
            {fields.location && <p className="field-error">{fields.location}</p>}
          </div>

          <div className="field date-field">
            <label htmlFor="occurredAt">¿Cuándo ocurrió? <span className="optional">Opcional</span></label>
            <input id="occurredAt" type="datetime-local" value={occurredAt} max={new Date().toISOString().slice(0, 16)} onChange={(event) => setOccurredAt(event.target.value)} aria-invalid={Boolean(fields.occurredAt)} />
            {fields.occurredAt && <p className="field-error">{fields.occurredAt}</p>}
          </div>

          {formError && <div className="error-banner" role="alert">{formError}</div>}

          <div className="form-footer">
            <p>Al enviar, la ubicación y los datos del incidente se compartirán para su gestión.</p>
            <button className="submit-button" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar reporte'}</button>
          </div>
        </form>

        <section className="nearby-section" aria-labelledby="nearby-heading">
          <div className="nearby-heading-row">
            <div>
              <p className="eyebrow">PARTICIPA EN TU ENTORNO</p>
              <h2 id="nearby-heading">Reportes cerca de ti</h2>
              <p className="intro-copy">Puedes confirmar o cuestionar reportes pendientes a menos de 500 metros.</p>
            </div>
            <button className="location-button nearby-refresh" type="button" onClick={loadNearbyReports} disabled={nearbyBusy}>
              {nearbyBusy ? 'Buscando…' : '◎ Buscar cerca de mí'}
            </button>
          </div>

          {nearbyError && <div className="error-banner nearby-message" role="alert">{nearbyError}</div>}
          {nearbyLoaded && nearbyReports.length === 0 && !nearbyError && (
            <div className="empty-nearby">No hay reportes pendientes cerca de tu ubicación.</div>
          )}
          <div className="nearby-list">
            {nearbyReports.map((report) => (
              <article className="nearby-card" key={report.id}>
                <div className="nearby-card-meta">
                  <span>{categories.find(([value]) => value === report.category)?.[1] ?? report.category}</span>
                  <span>{report.distanceMeters} m de ti</span>
                </div>
                <p className="nearby-description">{report.description}</p>
                <div className="response-controls" aria-label="Tu respuesta a este reporte">
                  <button
                    type="button"
                    className={`response-button${report.response === 'confirm' ? ' selected' : ''}`}
                    disabled={activeResponseReportId !== null || report.response === 'confirm'}
                    onClick={() => answerReport(report.id, 'confirm')}
                  >
                    {report.response === 'question' ? 'Cambiar a confirmar' : '✓ Confirmar'} ({report.counts.confirm})
                  </button>
                  <button
                    type="button"
                    className={`response-button question-button${report.response === 'question' ? ' selected' : ''}`}
                    disabled={activeResponseReportId !== null || report.response === 'question'}
                    onClick={() => answerReport(report.id, 'question')}
                  >
                    {report.response === 'confirm' ? 'Cambiar a cuestionar' : 'Cuestionar'} ({report.counts.question})
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="nearby-privacy">La ubicación se usa para comprobar la proximidad y no se muestra en los reportes.</p>
        </section>
    </>
  );
}

export default function App() {
  const [{ session, notice }, setAccount] = useState(() => ({ session: Session.restore(), notice: '' }));

  return (
    <main className="page-shell">
      <header className="page-header">
        <a className="brand" href="/" aria-label="Coordia, inicio"><span className="brand-mark">C</span> COORDIA</a>
        <span className="header-label">Comunicación ciudadana</span>
      </header>

      <section className="content">
        <Account session={session} notice={notice} onChange={(next, message) => setAccount({ session: next, notice: message })} />
        {session && <Reports session={session} onExpire={() => {
          session.clear();
          setAccount((current) => current.session === session
            ? { session: null, notice: 'La sesión ha caducado. Vuelve a iniciar sesión.' }
            : current);
        }} />}
      </section>
      <footer className="page-footer">COORDIA · Información para mejorar nuestro entorno</footer>
    </main>
  );
}
