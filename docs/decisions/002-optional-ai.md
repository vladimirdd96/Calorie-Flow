# ADR-002: Explicit, server-side managed AI features

**Date:** 2026-07-20  
**Status:** accepted

## Context

Label reading and coaching can help with food logging, but they send data to an external service and incur API cost.

## Decision

Keep Workers AI features user-invoked and server-side. Use the Cloudflare `AI` binding, so clients receive structured results and actionable errors but never an AI credential.

## Consequences

**Good:** Cost and privacy boundaries are clear; the core product works without an API key.  
**Bad:** AI-capable deployments need the Workers AI binding and authenticated request handling; free-tier limits can temporarily make AI unavailable.

## Alternatives considered

- Browser-side model-provider API calls — rejected because they expose credentials.
