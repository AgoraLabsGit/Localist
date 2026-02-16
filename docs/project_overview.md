# Localist - Project Overview

*AI-assisted social life planner for Buenos Aires (expanding to other cities later)*

**Core idea:** Tell me what to do this week without me having to search.

## Status: Pre-development (planning complete)

See full spec in chat history / memory files.

## Quick Reference

- **Stack:** Next.js + TypeScript + Tailwind + shadcn/ui, Supabase (Postgres + Auth), Stripe, n8n, Vercel
- **Data:** Eventbrite API, local BA sources, Google Places, RSS feeds → n8n ingestion → AI enrichment → Supabase
- **Model:** Freemium ($5/mo premium), affiliate commissions, venue promotions later
- **MVP scope:** BA only, events + highlights feed, basic filters, save/rate, weekly email digest, free/premium tiers
