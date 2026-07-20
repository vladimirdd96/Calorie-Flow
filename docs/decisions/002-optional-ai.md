# ADR-002: Explicit, server-side AI features

**Date:** 2026-07-20  
**Status:** accepted

## Context

Label reading and coaching can help with food logging, but they send data to an external service and incur API cost.

## Decision

Keep OpenAI features user-invoked and server-side. Store the API key only in runtime environment configuration; clients receive structured results and actionable errors, never the key.

## Consequences

**Good:** Cost and privacy boundaries are clear; the core product works without an API key.  
**Bad:** AI-capable deployments need runtime configuration and authenticated request handling.

## Alternatives considered

- Browser-side API calls — rejected because they expose credentials.
