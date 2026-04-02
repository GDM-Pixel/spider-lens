-- Spider-Lens — Migration V0.4 : webhook notifications + rapport hebdomadaire

ALTER TABLE alert_config ADD COLUMN webhook_url TEXT;
ALTER TABLE alert_config ADD COLUMN webhook_enabled INTEGER DEFAULT 0;
ALTER TABLE alert_config ADD COLUMN webhook_on_warning INTEGER DEFAULT 0;
ALTER TABLE alert_config ADD COLUMN weekly_report_enabled INTEGER DEFAULT 0;
