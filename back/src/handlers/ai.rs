use axum::{Json, http::StatusCode};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::env;

use crate::auth::AuthUser;
use crate::handlers::tasks::AppError;

const ZAI_ENDPOINT: &str = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL: &str = "glm-4.5-flash";

// ============================================
// Z.AI WIRE TYPES
// ============================================

#[derive(Serialize)]
struct ZaiChatRequest {
    model: &'static str,
    messages: Vec<ZaiMessage>,
    response_format: ZaiResponseFormat,
    temperature: f32,
    max_tokens: u32,
    thinking: ZaiThinking,
}

#[derive(Serialize)]
struct ZaiMessage {
    role: &'static str,
    content: String,
}

#[derive(Serialize)]
struct ZaiResponseFormat {
    #[serde(rename = "type")]
    kind: &'static str,
}

#[derive(Serialize)]
struct ZaiThinking {
    #[serde(rename = "type")]
    kind: &'static str,
}

#[derive(Deserialize)]
struct ZaiChatResponse {
    choices: Vec<ZaiChoice>,
}

#[derive(Deserialize)]
struct ZaiChoice {
    message: ZaiResponseMessage,
}

#[derive(Deserialize)]
struct ZaiResponseMessage {
    content: String,
}

/// Calls z.ai with a system + user message and JSON response_format.
/// Returns the raw assistant content (a JSON string).
async fn call_zai_json(
    system: String,
    user: String,
    max_tokens: u32,
) -> Result<String, AppError> {
    let api_key = env::var("ZAI_API_KEY").map_err(|_| {
        AppError(
            "ZAI_API_KEY not configured on server".to_string(),
            StatusCode::SERVICE_UNAVAILABLE,
        )
    })?;

    let request = ZaiChatRequest {
        model: ZAI_MODEL,
        messages: vec![
            ZaiMessage {
                role: "system",
                content: system,
            },
            ZaiMessage {
                role: "user",
                content: user,
            },
        ],
        response_format: ZaiResponseFormat {
            kind: "json_object",
        },
        temperature: 0.3,
        max_tokens,
        thinking: ZaiThinking { kind: "disabled" },
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(ZAI_ENDPOINT)
        .bearer_auth(&api_key)
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            AppError(
                format!("z.ai request failed: {}", e),
                StatusCode::BAD_GATEWAY,
            )
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError(
            format!("z.ai returned {}: {}", status, text),
            StatusCode::BAD_GATEWAY,
        ));
    }

    let parsed: ZaiChatResponse = resp.json().await.map_err(|e| {
        AppError(
            format!("z.ai response parse error: {}", e),
            StatusCode::BAD_GATEWAY,
        )
    })?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| {
            AppError(
                "z.ai returned no choices".to_string(),
                StatusCode::BAD_GATEWAY,
            )
        })
}

// ============================================
// PARSE TASK
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTaskRequest {
    pub text: String,
    #[serde(default)]
    pub available_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTaskResponse {
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
}

fn build_parse_system_prompt(available_tags: &[String]) -> String {
    let now = Utc::now();
    let today = now.format("%Y-%m-%d (%A)").to_string();
    let tags_line = if available_tags.is_empty() {
        "(no existing tags)".to_string()
    } else {
        available_tags.join(", ")
    };
    format!(
        "You parse free-form task descriptions into structured task data.\n\
         Today is {today}.\n\
         Return ONLY a JSON object (no prose, no markdown) with these exact keys:\n  \
           - title: string. The cleaned, imperative form of the task. Strip date/priority/tag mentions.\n  \
           - description: string | null. Use only if the user clearly intends extra detail beyond the title.\n  \
           - priority: \"low\" | \"medium\" | \"high\" | \"urgent\". Default \"medium\". Words like \"urgent\", \"asap\", \"critical\" -> urgent. \"important\" -> high. \"later\", \"someday\" -> low.\n  \
           - dueDate: string (YYYY-MM-DD) | null. Resolve relative dates from today. If no date is mentioned, return null.\n  \
           - tags: string[]. Pick zero or more from the existing tag list (case-insensitive match). Do NOT invent new tags.\n\
         Existing tags: {tags_line}.\n\
         If the input is empty or nonsense, still return the schema with sensible defaults (title=input, priority=\"medium\", others null/empty)."
    )
}

pub async fn parse_task(
    _auth: AuthUser,
    Json(body): Json<ParseTaskRequest>,
) -> Result<Json<ParseTaskResponse>, AppError> {
    let trimmed = body.text.trim();
    if trimmed.is_empty() {
        return Err(AppError(
            "text must not be empty".to_string(),
            StatusCode::BAD_REQUEST,
        ));
    }

    let content = call_zai_json(
        build_parse_system_prompt(&body.available_tags),
        trimmed.to_string(),
        400,
    )
    .await?;

    let task: ParseTaskResponse = serde_json::from_str(&content).map_err(|e| {
        AppError(
            format!("z.ai JSON parse error: {} - content: {}", e, content),
            StatusCode::BAD_GATEWAY,
        )
    })?;

    Ok(Json(task))
}

// ============================================
// DAILY STANDUP
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandupRequest {
    pub date_label: String,
    pub task_titles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StandupResponse {
    pub message: String,
}

const STANDUP_SYSTEM_PROMPT: &str = "You write concise daily standup messages for a software professional to post in Slack.\n\
Given a list of completed task titles, write a brief, human first-person summary.\n\
\n\
Style rules:\n\
- 2-5 short bullet points, each starting with '• ' (Unicode bullet).\n\
- Past tense, first person. Polish the wording — don't just repeat task titles.\n\
- Group closely related tasks into a single bullet when it improves clarity.\n\
- No filler ('Great day!', 'Crushed it', etc). No emojis. No closing sign-off.\n\
- Start the message with a heading like 'Done — <date>:' on its own line.\n\
\n\
Return ONLY a JSON object with this exact key:\n\
  - message: string. The full Slack-ready text (heading + bullets, separated by newlines).";

pub async fn daily_standup(
    _auth: AuthUser,
    Json(body): Json<StandupRequest>,
) -> Result<Json<StandupResponse>, AppError> {
    if body.task_titles.is_empty() {
        return Err(AppError(
            "taskTitles must not be empty".to_string(),
            StatusCode::BAD_REQUEST,
        ));
    }

    let user_prompt = format!(
        "Date: {}\n\nCompleted tasks:\n{}",
        body.date_label,
        body.task_titles
            .iter()
            .map(|t| format!("- {}", t))
            .collect::<Vec<_>>()
            .join("\n")
    );

    let content = call_zai_json(STANDUP_SYSTEM_PROMPT.to_string(), user_prompt, 400).await?;

    let standup: StandupResponse = serde_json::from_str(&content).map_err(|e| {
        AppError(
            format!("z.ai JSON parse error: {} - content: {}", e, content),
            StatusCode::BAD_GATEWAY,
        )
    })?;

    Ok(Json(standup))
}
