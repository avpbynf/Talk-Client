use directories::ProjectDirs;
use parking_lot::Mutex;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const SCHEMA_V1: &str = "
CREATE TABLE IF NOT EXISTS transcriptions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT,
    source TEXT NOT NULL DEFAULT 'local',
    enhanced INTEGER NOT NULL DEFAULT 0,
    audio_duration_ms INTEGER,
    processing_time_ms INTEGER,
    word_count INTEGER NOT NULL DEFAULT 0,
    char_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_timestamp
    ON transcriptions(timestamp DESC);
";

const AVERAGE_SPEECH_RATE_WPM: f64 = 150.0;
const OPENAI_WHISPER_COST_PER_MINUTE: f64 = 0.006;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionRow {
    pub id: String,
    pub text: String,
    pub timestamp: String,
    pub model: Option<String>,
    pub source: String,
    pub enhanced: bool,
    pub audio_duration_ms: Option<i64>,
    pub processing_time_ms: Option<i64>,
    pub word_count: i32,
    pub char_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTranscription {
    pub id: String,
    pub text: String,
    pub timestamp: String,
    pub model: Option<String>,
    pub source: String,
    pub enhanced: bool,
    pub audio_duration_ms: Option<i64>,
    pub processing_time_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStats {
    pub date: String,
    pub label: String,
    pub count: i64,
    pub words: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSummary {
    pub total_transcriptions: i64,
    pub total_words: i64,
    pub total_characters: i64,
    pub estimated_audio_minutes: f64,
    pub cost_saved_usd: f64,
    pub time_saved_minutes: f64,
    pub local_count: i64,
    pub server_count: i64,
    pub today_count: i64,
    pub week_count: i64,
    pub daily_stats: Vec<DailyStats>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub fn default_db_path() -> PathBuf {
    ProjectDirs::from("com", "avpbynf", "t4lk")
        .map(|dirs| dirs.config_dir().join("t4lk.db"))
        .unwrap_or_else(|| PathBuf::from("t4lk.db"))
}

fn weekday_label(weekday: i32) -> &'static str {
    match weekday {
        0 => "dim.",
        1 => "lun.",
        2 => "mar.",
        3 => "mer.",
        4 => "jeu.",
        5 => "ven.",
        6 => "sam.",
        _ => "?",
    }
}

// ---------------------------------------------------------------------------
// Database implementation
// ---------------------------------------------------------------------------

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous  = NORMAL;
             PRAGMA foreign_keys = ON;",
        )?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock();
        let version: i32 =
            conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

        if version < 1 {
            conn.execute_batch(SCHEMA_V1)?;
            conn.pragma_update(None, "user_version", 1)?;
        }

        Ok(())
    }

    // -- CRUD ---------------------------------------------------------------

    pub fn add_transcription(&self, entry: &NewTranscription) -> Result<()> {
        let word_count = entry.text.split_whitespace().count() as i32;
        let char_count = entry.text.len() as i32;

        let conn = self.conn.lock();
        conn.execute(
            "INSERT OR REPLACE INTO transcriptions
                (id, text, timestamp, model, source, enhanced,
                 audio_duration_ms, processing_time_ms, word_count, char_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.id,
                entry.text,
                entry.timestamp,
                entry.model,
                entry.source,
                entry.enhanced as i32,
                entry.audio_duration_ms,
                entry.processing_time_ms,
                word_count,
                char_count,
            ],
        )?;
        Ok(())
    }

    pub fn get_transcriptions(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<TranscriptionRow>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, text, timestamp, model, source, enhanced,
                    audio_duration_ms, processing_time_ms, word_count, char_count
             FROM transcriptions
             ORDER BY timestamp DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let rows = stmt
            .query_map(params![limit, offset], |row| {
                Ok(TranscriptionRow {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    timestamp: row.get(2)?,
                    model: row.get(3)?,
                    source: row.get(4)?,
                    enhanced: row.get::<_, i32>(5)? != 0,
                    audio_duration_ms: row.get(6)?,
                    processing_time_ms: row.get(7)?,
                    word_count: row.get(8)?,
                    char_count: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(rows)
    }

    pub fn get_transcription_count(&self) -> Result<i64> {
        let conn = self.conn.lock();
        conn.query_row("SELECT COUNT(*) FROM transcriptions", [], |row| {
            row.get(0)
        })
    }

    pub fn clear_transcriptions(&self) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM transcriptions", [])?;
        Ok(())
    }

    // -- Analytics ----------------------------------------------------------

    pub fn get_analytics_summary(
        &self,
        user_wpm: f64,
    ) -> Result<AnalyticsSummary> {
        let conn = self.conn.lock();

        // Global aggregates
        let (total, total_words, total_chars, local_count, server_count, today_count): (
            i64,
            i64,
            i64,
            i64,
            i64,
            i64,
        ) = conn.query_row(
            "SELECT
                COUNT(*),
                COALESCE(SUM(word_count), 0),
                COALESCE(SUM(char_count), 0),
                COALESCE(SUM(CASE WHEN source = 'local'  THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN source = 'server' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN date(timestamp, 'localtime') = date('now', 'localtime') THEN 1 ELSE 0 END), 0)
             FROM transcriptions",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )?;

        let week_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcriptions
             WHERE timestamp >= datetime('now', '-7 days')",
            [],
            |row| row.get(0),
        )?;

        // Daily stats for last 7 days (zero-filled via CTE)
        let mut stmt = conn.prepare(
            "WITH dates(d) AS (
                SELECT date('now', '-6 days', 'localtime')
                UNION ALL SELECT date('now', '-5 days', 'localtime')
                UNION ALL SELECT date('now', '-4 days', 'localtime')
                UNION ALL SELECT date('now', '-3 days', 'localtime')
                UNION ALL SELECT date('now', '-2 days', 'localtime')
                UNION ALL SELECT date('now', '-1 days', 'localtime')
                UNION ALL SELECT date('now', 'localtime')
            )
            SELECT dates.d,
                   CAST(strftime('%w', dates.d) AS INTEGER),
                   COALESCE(t.cnt, 0),
                   COALESCE(t.words, 0)
            FROM dates
            LEFT JOIN (
                SELECT date(timestamp, 'localtime') AS day,
                       COUNT(*)          AS cnt,
                       SUM(word_count)   AS words
                FROM transcriptions
                WHERE date(timestamp, 'localtime') >= date('now', '-6 days', 'localtime')
                GROUP BY date(timestamp, 'localtime')
            ) t ON dates.d = t.day
            ORDER BY dates.d",
        )?;

        let daily_stats = stmt
            .query_map([], |row| {
                let date: String = row.get(0)?;
                let weekday: i32 = row.get(1)?;
                let count: i64 = row.get(2)?;
                let words: i64 = row.get(3)?;
                Ok(DailyStats {
                    date,
                    label: weekday_label(weekday).to_string(),
                    count,
                    words,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        let estimated_audio_minutes =
            total_words as f64 / AVERAGE_SPEECH_RATE_WPM;
        let cost_saved_usd =
            estimated_audio_minutes * OPENAI_WHISPER_COST_PER_MINUTE;
        let time_saved_minutes = if user_wpm > 0.0 {
            total_words as f64 / user_wpm
        } else {
            0.0
        };

        Ok(AnalyticsSummary {
            total_transcriptions: total,
            total_words,
            total_characters: total_chars,
            estimated_audio_minutes,
            cost_saved_usd,
            time_saved_minutes,
            local_count,
            server_count,
            today_count,
            week_count,
            daily_stats,
        })
    }

}
