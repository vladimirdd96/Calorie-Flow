# ADR-001: Local-first tracking with optional cloud sync

**Date:** 2026-07-20  
**Status:** accepted

## Context

Calorie tracking needs to be quick, private, and available without network access. Some users still need an account and cross-device access.

## Decision

Store guest data in IndexedDB and make Supabase authentication and synchronization optional. The interface must continue to work when no public Supabase configuration is present.

## Consequences

**Good:** Immediate onboarding, offline use, and an account-free path.  
**Bad:** Synchronization and conflict handling add complexity, and clients must support both local and signed-in states.

## Alternatives considered

- Cloud-only storage — rejected because it requires account setup and network access before logging food.
