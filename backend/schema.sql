CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY,
    owner_id VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255),
    project_id VARCHAR(255),
    environment VARCHAR(50) DEFAULT 'production',
    status VARCHAR(50) DEFAULT 'pending',
    category VARCHAR(100),
    description TEXT,
    location GEOMETRY(Point, 4326),
    occurred_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_responses (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    response VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id, user_id)
);
