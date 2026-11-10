import React, { type FormEvent, useState } from 'react';
import LocationPicker, { type Coordinates } from './LocationPicker.js';

const categories = [
  ['infrastructure', 'Infraestructura'],
  ['safety', 'Seguridad'],
  ['accessibility', 'Accesibilidad'],
  ['environment', 'Medio ambiente'],
  ['other', 'Otro'],
] as const;

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface ApiError {
  error?: string;
  fields?: Record<string, string>;
}

function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default function App() {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [success, setSuccess] = useState<{ id: string | number; status: string } | null>(null);

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
      const response = await fetch(`${apiBase}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionStorage.getItem('coordia.accessToken')
            ? { Authorization: `Bearer ${sessionStorage.getItem('coordia.accessToken')}` }
            : {}),
        },
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
    } catch {
      setFormError('No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <a className="brand" href="/" aria-label="Coordia, inicio"><span className="brand-mark">C</span> COORDIA</a>
        <span className="header-label">Comunicación ciudadana</span>
      </header>

      <section className="content">
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
      </section>
      <footer className="page-footer">COORDIA · Información para mejorar nuestro entorno</footer>
    </main>
  );
}
