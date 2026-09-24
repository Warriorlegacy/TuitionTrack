-- ==============================================================================
-- TuitionTrack Migration: Expand ai_provider enum with all supported providers
-- Adds: 'ollama', 'ollama_cloud', 'nvidia', 'deepseek', 'github', 'opencode'
-- Idempotent: uses 'alter type ... add value if not exists'
-- ==============================================================================

alter type public.ai_provider add value if not exists 'ollama';
alter type public.ai_provider add value if not exists 'ollama_cloud';
alter type public.ai_provider add value if not exists 'nvidia';
alter type public.ai_provider add value if not exists 'deepseek';
alter type public.ai_provider add value if not exists 'github';
alter type public.ai_provider add value if not exists 'opencode';
