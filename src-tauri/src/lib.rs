use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::ImageFormat;
use rfd::FileDialog;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"];
const SETTINGS_ID: &str = "image";
const FALLBACK_CATEGORY_ID: &str = "image-category:other";
const DEFAULT_CATEGORIES: [(&str, &str, bool); 10] = [
    ("image-category:work", "Work", false),
    ("image-category:character", "Character", false),
    ("image-category:hair-color", "Hair Color", false),
    ("image-category:hair-style", "Hair Style", false),
    ("image-category:clothing", "Clothing", false),
    ("image-category:legs", "Legs", false),
    ("image-category:expression", "Expression", false),
    ("image-category:attribute", "Attribute", false),
    ("image-category:composition", "Composition", false),
    (FALLBACK_CATEGORY_ID, "Other", true),
];

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RecentFolder {
    mount_id: String,
    folder_path: String,
    used_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ImageAppSettings {
    image_import_recent_folders: Vec<RecentFolder>,
    image_import_recent_tag_ids: Vec<String>,
    image_tag_readings_backfill_done_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageMount {
    id: String,
    name: String,
    base_path: String,
    include_subdirs: bool,
    added_at: i64,
    last_scanned_at: Option<i64>,
    image_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageRecord {
    id: String,
    file_name: String,
    relative_path: String,
    folder_path: String,
    mount_id: String,
    absolute_path: String,
    thumbnail: Option<String>,
    tags: Vec<String>,
    auto_tag_ids: Vec<String>,
    favorite: bool,
    added_at: i64,
    updated_at: i64,
    is_missing: Option<bool>,
    last_seen_at: Option<i64>,
    width: Option<i64>,
    height: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageTagCategoryRecord {
    id: String,
    name: String,
    order: i64,
    created_at: i64,
    protected: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageTagRecord {
    id: String,
    name: String,
    normalized_name: String,
    search_readings: Vec<String>,
    category_id: String,
    is_auto: bool,
    created_at: i64,
    usage_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageTaggingMeta {
    image: ImageRecord,
    mount: Option<ImageMount>,
    auto_tags: Vec<ImageTagRecord>,
    manual_tags: Vec<ImageTagRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    done: i64,
    total: i64,
    added: i64,
    skipped: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImageQueryFilter {
    mount_id: Option<String>,
    folder: Option<String>,
    tag_ids: Vec<String>,
    scope: String,
    folder_depth: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportImageSource {
    file_name: String,
    mime_type: Option<String>,
    bytes_base64: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportImageArgs {
    mount_id: String,
    folder_path: String,
    items: Vec<ImportImageSource>,
    tag_ids: Vec<String>,
    mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LegacyImageData {
    mounts: Vec<ImageMount>,
    images: Vec<ImageRecord>,
    tags: Vec<ImageTagRecord>,
    categories: Vec<ImageTagCategoryRecord>,
    recent_folders: Vec<RecentFolder>,
    recent_tag_ids: Vec<String>,
    image_tag_readings_backfill_done_at: Option<i64>,
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

fn app_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|error| error.to_string())
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("atelier.db"))
}

fn thumbnail_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_cache_dir(app)?.join("image-thumbnails");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
      CREATE TABLE IF NOT EXISTS image_mounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_path TEXT NOT NULL,
        include_subdirs INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        last_scanned_at INTEGER,
        image_count INTEGER
      );

      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        mount_id TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        folder_path TEXT NOT NULL,
        absolute_path TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_missing INTEGER NOT NULL DEFAULT 0,
        last_seen_at INTEGER,
        width INTEGER,
        height INTEGER,
        thumbnail_key TEXT,
        UNIQUE(mount_id, relative_path)
      );

      CREATE TABLE IF NOT EXISTS image_tag_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        order_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        protected INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS image_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        search_readings_json TEXT NOT NULL DEFAULT '[]',
        category_id TEXT NOT NULL,
        is_auto INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS image_tag_links (
        image_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        source TEXT NOT NULL,
        linked_at INTEGER NOT NULL,
        PRIMARY KEY (image_id, tag_id, source)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        image_import_recent_folders_json TEXT NOT NULL DEFAULT '[]',
        image_import_recent_tag_ids_json TEXT NOT NULL DEFAULT '[]',
        image_tag_readings_backfill_done_at INTEGER
      );
    ",
    )
    .map_err(|error| error.to_string())?;

    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM image_tag_categories", [], |row| {
            row.get(0)
        })
        .map_err(|error| error.to_string())?;
    if existing_count == 0 {
        let now = now_ms();
        for (index, (id, name, protected)) in DEFAULT_CATEGORIES.iter().enumerate() {
            conn
        .execute(
          "INSERT INTO image_tag_categories (id, name, order_index, created_at, protected) VALUES (?1, ?2, ?3, ?4, ?5)",
          params![id, name, index as i64, now + index as i64, bool_to_i64(*protected)],
        )
        .map_err(|error| error.to_string())?;
        }
    }

    conn.execute(
        "INSERT OR IGNORE INTO app_settings (id) VALUES (?1)",
        params![SETTINGS_ID],
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

fn normalize_tag_name(value: &str) -> String {
    value.trim().to_lowercase()
}

fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            IMAGE_EXTENSIONS
                .iter()
                .any(|allowed| ext.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

fn folder_path_from_relative(relative_path: &str) -> String {
    let mut parts: Vec<&str> = relative_path.split('/').collect();
    if parts.len() <= 1 {
        String::new()
    } else {
        parts.pop();
        parts.join("/")
    }
}

fn derive_folder_auto_tag_names(folder_path: &str) -> Vec<String> {
    folder_path
        .split('/')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect()
}

fn tag_usage_count(conn: &Connection, tag_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(DISTINCT l.image_id)
       FROM image_tag_links l
       INNER JOIN images i ON i.id = l.image_id
       WHERE l.tag_id = ?1 AND i.is_missing = 0",
        params![tag_id],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

fn fetch_settings(conn: &Connection) -> Result<ImageAppSettings, String> {
    conn
    .query_row(
      "SELECT image_import_recent_folders_json, image_import_recent_tag_ids_json, image_tag_readings_backfill_done_at
       FROM app_settings WHERE id = ?1",
      params![SETTINGS_ID],
      |row| {
        let folders_json: String = row.get(0)?;
        let tag_ids_json: String = row.get(1)?;
        Ok(ImageAppSettings {
          image_import_recent_folders: serde_json::from_str(&folders_json).unwrap_or_default(),
          image_import_recent_tag_ids: serde_json::from_str(&tag_ids_json).unwrap_or_default(),
          image_tag_readings_backfill_done_at: row.get(2)?,
        })
      },
    )
    .map_err(|error| error.to_string())
}

fn store_settings(conn: &Connection, settings: &ImageAppSettings) -> Result<(), String> {
    conn.execute(
        "UPDATE app_settings
       SET image_import_recent_folders_json = ?1,
           image_import_recent_tag_ids_json = ?2,
           image_tag_readings_backfill_done_at = ?3
       WHERE id = ?4",
        params![
            serde_json::to_string(&settings.image_import_recent_folders)
                .map_err(|error| error.to_string())?,
            serde_json::to_string(&settings.image_import_recent_tag_ids)
                .map_err(|error| error.to_string())?,
            settings.image_tag_readings_backfill_done_at,
            SETTINGS_ID
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn ensure_tag(
    conn: &Connection,
    name: &str,
    category_id: Option<&str>,
    is_auto: bool,
) -> Result<String, String> {
    let normalized_name = normalize_tag_name(name);
    let existing: Option<(String, bool)> = conn
        .query_row(
            "SELECT id, is_auto FROM image_tags WHERE normalized_name = ?1",
            params![normalized_name],
            |row| Ok((row.get(0)?, row.get::<_, i64>(1)? != 0)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((tag_id, existing_is_auto)) = existing {
        if is_auto && !existing_is_auto {
            conn.execute(
                "UPDATE image_tags SET is_auto = 1 WHERE id = ?1",
                params![tag_id],
            )
            .map_err(|error| error.to_string())?;
        }
        return Ok(tag_id);
    }

    let tag_id = Uuid::new_v4().to_string();
    conn
    .execute(
      "INSERT INTO image_tags (id, name, normalized_name, search_readings_json, category_id, is_auto, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      params![
        tag_id,
        name.trim(),
        normalized_name,
        "[]",
        category_id.unwrap_or(FALLBACK_CATEGORY_ID),
        bool_to_i64(is_auto),
        now_ms()
      ],
    )
    .map_err(|error| error.to_string())?;
    Ok(tag_id)
}

fn image_link_ids(
    conn: &Connection,
    image_id: &str,
    source: Option<&str>,
) -> Result<Vec<String>, String> {
    let sql = match source {
        Some(_) => {
            "SELECT tag_id FROM image_tag_links WHERE image_id = ?1 AND source = ?2 ORDER BY linked_at"
        }
        None => "SELECT tag_id FROM image_tag_links WHERE image_id = ?1 ORDER BY linked_at",
    };
    let mut statement = conn.prepare(sql).map_err(|error| error.to_string())?;
    let mut values = Vec::new();
    if let Some(source) = source {
        let rows = statement
            .query_map(params![image_id, source], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        for row in rows {
            values.push(row.map_err(|error| error.to_string())?);
        }
    } else {
        let rows = statement
            .query_map(params![image_id], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        for row in rows {
            values.push(row.map_err(|error| error.to_string())?);
        }
    }
    Ok(values)
}

fn build_image_record_base(row: &rusqlite::Row<'_>) -> Result<ImageRecord, rusqlite::Error> {
    let id: String = row.get("id")?;
    Ok(ImageRecord {
        id,
        file_name: row.get("file_name")?,
        relative_path: row.get("relative_path")?,
        folder_path: row.get("folder_path")?,
        mount_id: row.get("mount_id")?,
        absolute_path: row.get("absolute_path")?,
        thumbnail: None,
        tags: Vec::new(),
        auto_tag_ids: Vec::new(),
        favorite: row.get::<_, i64>("favorite")? != 0,
        added_at: row.get("added_at")?,
        updated_at: row.get("updated_at")?,
        is_missing: Some(row.get::<_, i64>("is_missing")? != 0),
        last_seen_at: row.get("last_seen_at")?,
        width: row.get("width")?,
        height: row.get("height")?,
    })
}

fn hydrate_image_record(conn: &Connection, mut image: ImageRecord) -> Result<ImageRecord, String> {
    image.tags = image_link_ids(conn, &image.id, None)?;
    image.auto_tag_ids = image_link_ids(conn, &image.id, Some("auto"))?;
    Ok(image)
}

fn load_image_record_by_id(conn: &Connection, image_id: &str) -> Result<ImageRecord, String> {
    let image = conn
        .query_row(
            "SELECT id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite, added_at, updated_at, is_missing, last_seen_at, width, height
             FROM images WHERE id = ?1",
            params![image_id],
            build_image_record_base,
        )
        .map_err(|error| error.to_string())?;
    hydrate_image_record(conn, image)
}

fn load_image_record_by_mount_relative(
    conn: &Connection,
    mount_id: &str,
    relative_path: &str,
) -> Result<ImageRecord, String> {
    let image = conn
        .query_row(
            "SELECT id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite, added_at, updated_at, is_missing, last_seen_at, width, height
             FROM images WHERE mount_id = ?1 AND relative_path = ?2",
            params![mount_id, relative_path],
            build_image_record_base,
        )
        .map_err(|error| error.to_string())?;
    hydrate_image_record(conn, image)
}

fn fetch_mount(conn: &Connection, mount_id: &str) -> Result<Option<ImageMount>, String> {
    conn.query_row(
        "SELECT id, name, base_path, include_subdirs, added_at, last_scanned_at, image_count
       FROM image_mounts WHERE id = ?1",
        params![mount_id],
        |row| {
            Ok(ImageMount {
                id: row.get(0)?,
                name: row.get(1)?,
                base_path: row.get(2)?,
                include_subdirs: row.get::<_, i64>(3)? != 0,
                added_at: row.get(4)?,
                last_scanned_at: row.get(5)?,
                image_count: row.get(6)?,
            })
        },
    )
    .optional()
    .map_err(|error| error.to_string())
}

fn update_auto_tags_for_image(
    conn: &Connection,
    image_id: &str,
    folder_path: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM image_tag_links WHERE image_id = ?1 AND source = 'auto'",
        params![image_id],
    )
    .map_err(|error| error.to_string())?;

    for tag_name in derive_folder_auto_tag_names(folder_path) {
        let tag_id = ensure_tag(conn, &tag_name, Some(FALLBACK_CATEGORY_ID), true)?;
        conn
      .execute(
        "INSERT OR IGNORE INTO image_tag_links (image_id, tag_id, source, linked_at) VALUES (?1, ?2, 'auto', ?3)",
        params![image_id, tag_id, now_ms()],
      )
      .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn resync_image_count(conn: &Connection, mount_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE mount_id = ?1 AND is_missing = 0",
            params![mount_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE image_mounts SET image_count = ?1 WHERE id = ?2",
        params![count, mount_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn upsert_image_from_path(
    conn: &Connection,
    mount_id: &str,
    base_path: &Path,
    image_path: &Path,
    added_at_fallback: i64,
) -> Result<bool, String> {
    let relative_path = image_path
        .strip_prefix(base_path)
        .map_err(|error| error.to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    let folder_path = folder_path_from_relative(&relative_path);
    let absolute_path = image_path.to_string_lossy().to_string();
    let file_name = image_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();

    let dimensions = image::image_dimensions(image_path).ok();
    let existing: Option<(String, i64)> = conn
        .query_row(
            "SELECT id, added_at FROM images WHERE mount_id = ?1 AND relative_path = ?2",
            params![mount_id, relative_path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let image_id = existing
        .as_ref()
        .map(|(id, _)| id.clone())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let added_at = existing
        .as_ref()
        .map(|(_, value)| *value)
        .unwrap_or(added_at_fallback);
    let now = now_ms();

    conn
    .execute(
      "INSERT INTO images (
        id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite,
        added_at, updated_at, is_missing, last_seen_at, width, height
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE((SELECT favorite FROM images WHERE id = ?1), 0), ?7, ?8, 0, ?8, ?9, ?10)
      ON CONFLICT(mount_id, relative_path) DO UPDATE SET
        file_name = excluded.file_name,
        folder_path = excluded.folder_path,
        absolute_path = excluded.absolute_path,
        updated_at = excluded.updated_at,
        is_missing = 0,
        last_seen_at = excluded.last_seen_at,
        width = excluded.width,
        height = excluded.height",
      params![
        image_id,
        mount_id,
        relative_path,
        file_name,
        folder_path,
        absolute_path,
        added_at,
        now,
        dimensions.map(|(width, _)| width as i64),
        dimensions.map(|(_, height)| height as i64)
      ],
    )
    .map_err(|error| error.to_string())?;

    update_auto_tags_for_image(conn, &image_id, &folder_path)?;
    Ok(existing.is_none())
}

fn file_to_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

fn thumbnail_key_for_record(image: &ImageRecord) -> String {
    let mut hasher = Sha256::new();
    hasher.update(image.mount_id.as_bytes());
    hasher.update(image.relative_path.as_bytes());
    hasher.update(image.updated_at.to_le_bytes());
    format!("{:x}", hasher.finalize())
}

fn write_thumbnail(path: &Path, destination: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let image = image::load_from_memory(&bytes).map_err(|error| error.to_string())?;
    let thumbnail = image.thumbnail(320, 320);
    let mut buffer = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut buffer, ImageFormat::WebP)
        .map_err(|error| error.to_string())?;
    fs::write(destination, buffer.into_inner()).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn pick_image_mount() -> Option<String> {
    FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_image_mount(
    app: AppHandle,
    base_path: String,
    include_subdirs: bool,
) -> Result<ImageMount, String> {
    let conn = open_db(&app)?;
    let now = now_ms();
    let path = PathBuf::from(&base_path);
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("mount")
        .to_string();
    let mount = ImageMount {
        id: Uuid::new_v4().to_string(),
        name,
        base_path,
        include_subdirs,
        added_at: now,
        last_scanned_at: None,
        image_count: Some(0),
    };
    conn
    .execute(
      "INSERT INTO image_mounts (id, name, base_path, include_subdirs, added_at, image_count) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
      params![mount.id, mount.name, mount.base_path, bool_to_i64(mount.include_subdirs), mount.added_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(mount)
}

#[tauri::command]
fn remove_image_mount(app: AppHandle, mount_id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "DELETE FROM image_tag_links WHERE image_id IN (SELECT id FROM images WHERE mount_id = ?1)",
        params![mount_id.clone()],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM images WHERE mount_id = ?1",
        params![mount_id.clone()],
    )
    .map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM image_mounts WHERE id = ?1", params![mount_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_image_mounts(app: AppHandle) -> Result<Vec<ImageMount>, String> {
    let conn = open_db(&app)?;
    let mut statement = conn
        .prepare(
            "SELECT id, name, base_path, include_subdirs, added_at, last_scanned_at, image_count
       FROM image_mounts ORDER BY added_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(ImageMount {
                id: row.get(0)?,
                name: row.get(1)?,
                base_path: row.get(2)?,
                include_subdirs: row.get::<_, i64>(3)? != 0,
                added_at: row.get(4)?,
                last_scanned_at: row.get(5)?,
                image_count: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|error| error.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
fn scan_image_mount(app: AppHandle, mount_id: String) -> Result<ScanProgress, String> {
    let conn = open_db(&app)?;
    let mount =
        fetch_mount(&conn, &mount_id)?.ok_or_else(|| "Image mount not found.".to_string())?;
    let base_path = PathBuf::from(&mount.base_path);
    if !base_path.exists() {
        return Err("Mount path does not exist.".to_string());
    }

    let mut added = 0_i64;
    let mut skipped = 0_i64;
    let mut seen = HashSet::new();
    let walker = if mount.include_subdirs {
        WalkDir::new(&base_path)
    } else {
        WalkDir::new(&base_path).max_depth(1)
    };

    let mut total = 0_i64;
    for entry in walker.into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !entry.file_type().is_file() {
            continue;
        }
        total += 1;
        if !is_supported_image(path) {
            skipped += 1;
            continue;
        }
        let relative_path = path
            .strip_prefix(&base_path)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        seen.insert(relative_path);
        if upsert_image_from_path(&conn, &mount.id, &base_path, path, now_ms())? {
            added += 1;
        } else {
            skipped += 1;
        }
    }

    let mut statement = conn
        .prepare("SELECT id, relative_path FROM images WHERE mount_id = ?1")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![mount.id.clone()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    for row in rows {
        let (image_id, relative_path) = row.map_err(|error| error.to_string())?;
        if !seen.contains(&relative_path) {
            conn.execute(
                "UPDATE images SET is_missing = 1, updated_at = ?2 WHERE id = ?1",
                params![image_id, now_ms()],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    conn.execute(
        "UPDATE image_mounts SET last_scanned_at = ?1 WHERE id = ?2",
        params![now_ms(), mount.id.clone()],
    )
    .map_err(|error| error.to_string())?;
    resync_image_count(&conn, &mount.id)?;

    Ok(ScanProgress {
        done: total,
        total,
        added,
        skipped,
    })
}

#[tauri::command]
fn list_images(app: AppHandle, filter: ImageQueryFilter) -> Result<Vec<ImageRecord>, String> {
    let conn = open_db(&app)?;
    let mut statement = conn
    .prepare(
      "SELECT id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite, added_at, updated_at, is_missing, last_seen_at, width, height
       FROM images ORDER BY added_at DESC",
    )
    .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], build_image_record_base)
        .map_err(|error| error.to_string())?;

    let mut images = Vec::new();
    for row in rows {
        let image = hydrate_image_record(&conn, row.map_err(|error| error.to_string())?)?;
        if image.is_missing == Some(true) {
            continue;
        }
        if let Some(mount_id) = &filter.mount_id {
            if &image.mount_id != mount_id {
                continue;
            }
        }
        if let Some(folder) = &filter.folder {
            let in_scope = if filter.scope == "current" {
                if filter.folder_depth.as_deref() == Some("tree") {
                    image.folder_path == *folder
                        || image.folder_path.starts_with(&format!("{folder}/"))
                } else {
                    image.folder_path == *folder
                }
            } else {
                true
            };
            if !in_scope {
                continue;
            }
        } else if filter.scope == "current"
            && filter.folder_depth.as_deref() == Some("direct")
            && !image.folder_path.is_empty()
        {
            // no-op; root allows all direct children for mount
        }

        if !filter.tag_ids.is_empty()
            && !filter
                .tag_ids
                .iter()
                .all(|tag_id| image.tags.contains(tag_id))
        {
            continue;
        }

        images.push(image);
    }

    Ok(images)
}

#[tauri::command]
fn get_image_detail(app: AppHandle, image_id: String) -> Result<ImageTaggingMeta, String> {
    let conn = open_db(&app)?;
    let image = load_image_record_by_id(&conn, &image_id)?;

    let mount = fetch_mount(&conn, &image.mount_id)?;
    let tags = list_image_tags(app.clone())?;
    let tag_map: HashMap<String, ImageTagRecord> =
        tags.into_iter().map(|tag| (tag.id.clone(), tag)).collect();
    let auto_tags = image
        .auto_tag_ids
        .iter()
        .filter_map(|tag_id| tag_map.get(tag_id).cloned())
        .collect();
    let auto_id_set: HashSet<String> = image.auto_tag_ids.iter().cloned().collect();
    let manual_tags = image
        .tags
        .iter()
        .filter(|tag_id| !auto_id_set.contains(*tag_id))
        .filter_map(|tag_id| tag_map.get(tag_id).cloned())
        .collect();

    Ok(ImageTaggingMeta {
        image,
        mount,
        auto_tags,
        manual_tags,
    })
}

#[tauri::command]
fn toggle_image_favorite(app: AppHandle, image_id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn
    .execute(
      "UPDATE images SET favorite = CASE favorite WHEN 0 THEN 1 ELSE 0 END, updated_at = ?2 WHERE id = ?1",
      params![image_id, now_ms()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_image_tag_categories(app: AppHandle) -> Result<Vec<ImageTagCategoryRecord>, String> {
    let conn = open_db(&app)?;
    let mut statement = conn
        .prepare(
            "SELECT id, name, order_index, created_at, protected
       FROM image_tag_categories ORDER BY order_index ASC, created_at ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(ImageTagCategoryRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                order: row.get(2)?,
                created_at: row.get(3)?,
                protected: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|error| error.to_string())?;
    let mut categories = Vec::new();
    for row in rows {
        categories.push(row.map_err(|error| error.to_string())?);
    }
    Ok(categories)
}

#[tauri::command]
fn create_image_tag_category(
    app: AppHandle,
    name: String,
) -> Result<ImageTagCategoryRecord, String> {
    let conn = open_db(&app)?;
    let next_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM image_tag_categories",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let category = ImageTagCategoryRecord {
        id: Uuid::new_v4().to_string(),
        name: name.trim().to_string(),
        order: next_order,
        created_at: now_ms(),
        protected: false,
    };
    conn
    .execute(
      "INSERT INTO image_tag_categories (id, name, order_index, created_at, protected) VALUES (?1, ?2, ?3, ?4, 0)",
      params![category.id, category.name, category.order, category.created_at],
    )
    .map_err(|error| error.to_string())?;
    Ok(category)
}

#[tauri::command]
fn rename_image_tag_category(
    app: AppHandle,
    category_id: String,
    name: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "UPDATE image_tag_categories SET name = ?2 WHERE id = ?1",
        params![category_id, name.trim()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn reorder_image_tag_categories(app: AppHandle, category_ids: Vec<String>) -> Result<(), String> {
    let conn = open_db(&app)?;
    for (index, category_id) in category_ids.iter().enumerate() {
        conn.execute(
            "UPDATE image_tag_categories SET order_index = ?2 WHERE id = ?1",
            params![category_id, index as i64],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn delete_image_tag_category(app: AppHandle, category_id: String) -> Result<(), String> {
    if category_id == FALLBACK_CATEGORY_ID {
        return Err("Protected category cannot be deleted.".to_string());
    }
    let conn = open_db(&app)?;
    conn.execute(
        "UPDATE image_tags SET category_id = ?2 WHERE category_id = ?1",
        params![category_id.clone(), FALLBACK_CATEGORY_ID],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM image_tag_categories WHERE id = ?1",
        params![category_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_image_tags(app: AppHandle) -> Result<Vec<ImageTagRecord>, String> {
    let conn = open_db(&app)?;
    let mut statement = conn
    .prepare(
      "SELECT id, name, normalized_name, search_readings_json, category_id, is_auto, created_at
       FROM image_tags ORDER BY name ASC",
    )
    .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let tag_id: String = row.get(0)?;
            Ok(ImageTagRecord {
                id: tag_id.clone(),
                name: row.get(1)?,
                normalized_name: row.get(2)?,
                search_readings: serde_json::from_str::<Vec<String>>(&row.get::<_, String>(3)?)
                    .unwrap_or_default(),
                category_id: row.get(4)?,
                is_auto: row.get::<_, i64>(5)? != 0,
                created_at: row.get(6)?,
                usage_count: tag_usage_count(&conn, &tag_id).unwrap_or_default(),
            })
        })
        .map_err(|error| error.to_string())?;
    let mut tags = Vec::new();
    for row in rows {
        tags.push(row.map_err(|error| error.to_string())?);
    }
    tags.sort_by(|a, b| b.usage_count.cmp(&a.usage_count).then(a.name.cmp(&b.name)));
    Ok(tags)
}

#[tauri::command]
fn create_image_tag(
    app: AppHandle,
    name: String,
    category_id: String,
) -> Result<ImageTagRecord, String> {
    let conn = open_db(&app)?;
    let tag_id = ensure_tag(&conn, &name, Some(&category_id), false)?;
    let tags = list_image_tags(app)?;
    tags.into_iter()
        .find(|tag| tag.id == tag_id)
        .ok_or_else(|| "Created tag not found.".to_string())
}

#[tauri::command]
fn rename_image_tag(app: AppHandle, tag_id: String, name: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "UPDATE image_tags SET name = ?2, normalized_name = ?3 WHERE id = ?1",
        params![tag_id, name.trim(), normalize_tag_name(&name)],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn move_image_tag_category(
    app: AppHandle,
    tag_id: String,
    category_id: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "UPDATE image_tags SET category_id = ?2 WHERE id = ?1",
        params![tag_id, category_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn merge_image_tags(
    app: AppHandle,
    source_tag_id: String,
    target_tag_id: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "INSERT OR IGNORE INTO image_tag_links (image_id, tag_id, source, linked_at)
       SELECT image_id, ?2, source, linked_at FROM image_tag_links WHERE tag_id = ?1",
        params![source_tag_id.clone(), target_tag_id],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM image_tag_links WHERE tag_id = ?1",
        params![source_tag_id.clone()],
    )
    .map_err(|error| error.to_string())?;
    conn.execute(
        "DELETE FROM image_tags WHERE id = ?1",
        params![source_tag_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_image_tag(app: AppHandle, tag_id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute(
        "DELETE FROM image_tag_links WHERE tag_id = ?1",
        params![tag_id.clone()],
    )
    .map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM image_tags WHERE id = ?1", params![tag_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn add_tags_to_images(
    app: AppHandle,
    image_ids: Vec<String>,
    tag_ids: Vec<String>,
    source: Option<String>,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    let now = now_ms();
    for image_id in image_ids {
        for tag_id in &tag_ids {
            conn
        .execute(
          "INSERT OR IGNORE INTO image_tag_links (image_id, tag_id, source, linked_at) VALUES (?1, ?2, ?3, ?4)",
          params![image_id, tag_id, source.as_deref().unwrap_or("manual"), now],
        )
        .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn remove_tags_from_images(
    app: AppHandle,
    image_ids: Vec<String>,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    for image_id in image_ids {
        for tag_id in &tag_ids {
            conn
        .execute(
          "DELETE FROM image_tag_links WHERE image_id = ?1 AND tag_id = ?2 AND source = 'manual'",
          params![image_id, tag_id],
        )
        .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn list_missing_images(app: AppHandle) -> Result<Vec<ImageRecord>, String> {
    let conn = open_db(&app)?;
    let mut statement = conn
    .prepare(
      "SELECT id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite, added_at, updated_at, is_missing, last_seen_at, width, height
       FROM images WHERE is_missing = 1 ORDER BY updated_at DESC",
    )
    .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], build_image_record_base)
        .map_err(|error| error.to_string())?;
    let mut images = Vec::new();
    for row in rows {
        images.push(hydrate_image_record(
            &conn,
            row.map_err(|error| error.to_string())?,
        )?);
    }
    Ok(images)
}

#[tauri::command]
fn remove_missing_images(app: AppHandle, image_ids: Vec<String>) -> Result<(), String> {
    let conn = open_db(&app)?;
    for image_id in &image_ids {
        conn.execute(
            "DELETE FROM image_tag_links WHERE image_id = ?1",
            params![image_id],
        )
        .map_err(|error| error.to_string())?;
    }
    for image_id in image_ids {
        conn.execute(
            "DELETE FROM images WHERE id = ?1 AND is_missing = 1",
            params![image_id],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_child_directories(
    app: AppHandle,
    mount_id: String,
    folder_path: String,
) -> Result<Vec<String>, String> {
    let conn = open_db(&app)?;
    let mount =
        fetch_mount(&conn, &mount_id)?.ok_or_else(|| "Image mount not found.".to_string())?;
    let target = if folder_path.is_empty() {
        PathBuf::from(mount.base_path)
    } else {
        PathBuf::from(mount.base_path).join(folder_path.replace('/', "\\"))
    };
    let mut items = Vec::new();
    for entry in fs::read_dir(target).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            items.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    items.sort();
    Ok(items)
}

#[tauri::command]
fn create_subdirectory(
    app: AppHandle,
    mount_id: String,
    parent_folder_path: String,
    new_folder_name: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    let mount =
        fetch_mount(&conn, &mount_id)?.ok_or_else(|| "Image mount not found.".to_string())?;
    let target = if parent_folder_path.is_empty() {
        PathBuf::from(mount.base_path).join(&new_folder_name)
    } else {
        PathBuf::from(mount.base_path)
            .join(parent_folder_path.replace('/', "\\"))
            .join(&new_folder_name)
    };
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_images(app: AppHandle, args: ImportImageArgs) -> Result<Vec<ImageRecord>, String> {
    if args.mode.as_deref().unwrap_or("copy") != "copy" {
        return Err("Only copy mode is supported in v1.".to_string());
    }

    let conn = open_db(&app)?;
    let mount =
        fetch_mount(&conn, &args.mount_id)?.ok_or_else(|| "Image mount not found.".to_string())?;
    let destination_dir = if args.folder_path.is_empty() {
        PathBuf::from(&mount.base_path)
    } else {
        PathBuf::from(&mount.base_path).join(args.folder_path.replace('/', "\\"))
    };
    fs::create_dir_all(&destination_dir).map_err(|error| error.to_string())?;

    let mut imported = Vec::new();
    for item in args.items {
        let destination = destination_dir.join(&item.file_name);
        if destination.exists() {
            continue;
        }
        let bytes = BASE64
            .decode(item.bytes_base64.as_bytes())
            .map_err(|error| error.to_string())?;
        fs::write(&destination, bytes).map_err(|error| error.to_string())?;
        upsert_image_from_path(
            &conn,
            &mount.id,
            Path::new(&mount.base_path),
            &destination,
            now_ms(),
        )?;
        let relative_path = destination
            .strip_prefix(&mount.base_path)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let image = load_image_record_by_mount_relative(&conn, &mount.id, &relative_path)?;
        for tag_id in &args.tag_ids {
            conn
        .execute(
          "INSERT OR IGNORE INTO image_tag_links (image_id, tag_id, source, linked_at) VALUES (?1, ?2, 'manual', ?3)",
          params![image.id.clone(), tag_id, now_ms()],
        )
        .map_err(|error| error.to_string())?;
        }
        imported.push(image);
    }

    let mut settings = fetch_settings(&conn)?;
    let next_folders = std::iter::once(RecentFolder {
        mount_id: mount.id.clone(),
        folder_path: args.folder_path.clone(),
        used_at: now_ms(),
    })
    .chain(
        settings
            .image_import_recent_folders
            .into_iter()
            .filter(|entry| !(entry.mount_id == mount.id && entry.folder_path == args.folder_path)),
    )
    .take(8)
    .collect();
    settings.image_import_recent_folders = next_folders;
    let mut next_recent_tags = args.tag_ids.clone();
    next_recent_tags.extend(
        settings
            .image_import_recent_tag_ids
            .into_iter()
            .filter(|tag_id| !args.tag_ids.contains(tag_id)),
    );
    next_recent_tags.truncate(12);
    settings.image_import_recent_tag_ids = next_recent_tags;
    store_settings(&conn, &settings)?;
    resync_image_count(&conn, &mount.id)?;

    Ok(imported)
}

#[tauri::command]
fn ensure_thumbnail(app: AppHandle, image_id: String) -> Result<Option<String>, String> {
    let conn = open_db(&app)?;
    let image = load_image_record_by_id(&conn, &image_id)?;
    if image.is_missing == Some(true) {
        return Ok(None);
    }
    let key = thumbnail_key_for_record(&image);
    let path = thumbnail_cache_dir(&app)?.join(format!("{key}.webp"));
    if !path.exists() {
        write_thumbnail(Path::new(&image.absolute_path), &path)?;
    }
    file_to_data_url(&path).map(Some)
}

#[tauri::command]
fn get_image_file_data_url(app: AppHandle, image_id: String) -> Result<Option<String>, String> {
    let conn = open_db(&app)?;
    let absolute_path: Option<String> = conn
        .query_row(
            "SELECT absolute_path FROM images WHERE id = ?1",
            params![image_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    match absolute_path {
        Some(path) if Path::new(&path).exists() => file_to_data_url(Path::new(&path)).map(Some),
        _ => Ok(None),
    }
}

#[tauri::command]
fn get_image_app_settings(app: AppHandle) -> Result<ImageAppSettings, String> {
    let conn = open_db(&app)?;
    fetch_settings(&conn)
}

#[tauri::command]
fn set_image_app_settings(
    app: AppHandle,
    settings: ImageAppSettings,
) -> Result<ImageAppSettings, String> {
    let conn = open_db(&app)?;
    store_settings(&conn, &settings)?;
    fetch_settings(&conn)
}

#[tauri::command]
fn export_legacy_image_data(app: AppHandle) -> Result<LegacyImageData, String> {
    let mounts = list_image_mounts(app.clone())?;
    let images = list_images(
        app.clone(),
        ImageQueryFilter {
            mount_id: None,
            folder: None,
            tag_ids: vec![],
            scope: "all".into(),
            folder_depth: None,
        },
    )?;
    let tags = list_image_tags(app.clone())?;
    let categories = list_image_tag_categories(app.clone())?;
    let settings = get_image_app_settings(app)?;
    Ok(LegacyImageData {
        mounts,
        images,
        tags,
        categories,
        recent_folders: settings.image_import_recent_folders,
        recent_tag_ids: settings.image_import_recent_tag_ids,
        image_tag_readings_backfill_done_at: settings.image_tag_readings_backfill_done_at,
    })
}

#[tauri::command]
fn import_legacy_image_data(app: AppHandle, payload: String) -> Result<(), String> {
    let data: LegacyImageData =
        serde_json::from_str(&payload).map_err(|error| error.to_string())?;
    let conn = open_db(&app)?;
    for category in data.categories {
        conn
      .execute(
        "INSERT OR REPLACE INTO image_tag_categories (id, name, order_index, created_at, protected) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![category.id, category.name, category.order, category.created_at, bool_to_i64(category.protected)],
      )
      .map_err(|error| error.to_string())?;
    }
    for mount in data.mounts {
        conn
      .execute(
        "INSERT OR REPLACE INTO image_mounts (id, name, base_path, include_subdirs, added_at, last_scanned_at, image_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![mount.id, mount.name, mount.base_path, bool_to_i64(mount.include_subdirs), mount.added_at, mount.last_scanned_at, mount.image_count],
      )
      .map_err(|error| error.to_string())?;
    }
    for tag in data.tags {
        conn
      .execute(
        "INSERT OR REPLACE INTO image_tags (id, name, normalized_name, search_readings_json, category_id, is_auto, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![tag.id, tag.name, tag.normalized_name, serde_json::to_string(&tag.search_readings).map_err(|error| error.to_string())?, tag.category_id, bool_to_i64(tag.is_auto), tag.created_at],
      )
      .map_err(|error| error.to_string())?;
    }
    for image in data.images {
        conn
      .execute(
        "INSERT OR REPLACE INTO images (id, mount_id, relative_path, file_name, folder_path, absolute_path, favorite, added_at, updated_at, is_missing, last_seen_at, width, height)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![image.id, image.mount_id, image.relative_path, image.file_name, image.folder_path, image.absolute_path, bool_to_i64(image.favorite), image.added_at, image.updated_at, bool_to_i64(image.is_missing.unwrap_or(false)), image.last_seen_at, image.width, image.height],
      )
      .map_err(|error| error.to_string())?;
        for tag_id in image.tags {
            let source = if image.auto_tag_ids.contains(&tag_id) {
                "auto"
            } else {
                "manual"
            };
            conn
        .execute(
          "INSERT OR IGNORE INTO image_tag_links (image_id, tag_id, source, linked_at) VALUES (?1, ?2, ?3, ?4)",
          params![image.id, tag_id, source, now_ms()],
        )
        .map_err(|error| error.to_string())?;
        }
    }

    store_settings(
        &conn,
        &ImageAppSettings {
            image_import_recent_folders: data.recent_folders,
            image_import_recent_tag_ids: data.recent_tag_ids,
            image_tag_readings_backfill_done_at: data.image_tag_readings_backfill_done_at,
        },
    )?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            pick_image_mount,
            create_image_mount,
            remove_image_mount,
            list_image_mounts,
            scan_image_mount,
            list_images,
            get_image_detail,
            toggle_image_favorite,
            list_image_tag_categories,
            create_image_tag_category,
            rename_image_tag_category,
            reorder_image_tag_categories,
            delete_image_tag_category,
            list_image_tags,
            create_image_tag,
            rename_image_tag,
            move_image_tag_category,
            merge_image_tags,
            delete_image_tag,
            add_tags_to_images,
            remove_tags_from_images,
            list_missing_images,
            remove_missing_images,
            list_child_directories,
            create_subdirectory,
            import_images,
            ensure_thumbnail,
            get_image_file_data_url,
            get_image_app_settings,
            set_image_app_settings,
            export_legacy_image_data,
            import_legacy_image_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running atelier");
}
