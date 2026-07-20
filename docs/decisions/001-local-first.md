# ADR-001: Authenticated tracking with a local cache

**Date:** 2026-07-20  
**Status:** accepted

## Context

Calorie tracking needs to be quick, private, and available without network access while keeping each diary tied to an account for recovery and cross-device access.

## Decision

Require Supabase authentication before opening the diary. Store the active account's working copy in IndexedDB for fast and offline use, and synchronize it with Supabase when configured and online.

## Consequences

**Good:** Private account ownership, cross-device recovery, and offline use.
**Bad:** Account setup and synchronization are required before tracking can begin.

## Alternatives considered

- Cloud-only storage — rejected because it would make offline tracking unavailable.
