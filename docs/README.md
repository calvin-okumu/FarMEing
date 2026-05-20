# FarmTrack — Developer Documentation

This directory contains reference documentation for the FarmTrack full-stack farm management application.

## Contents

| Document | Description |
|---|---|
| [backend.md](./backend.md) | Node.js/Express REST API — models, endpoints, Prisma schema |
| [frontend.md](./frontend.md) | Expo/React Native mobile app — screens, WatermelonDB, sync service, localization |
| [ai_assisted_development.md](./ai_assisted_development.md) | **AI-Assisted Development Guide** — Using specialized skills for scaffolding and auditing |
| [implementation/farm_app_implementation_v2.md](./implementation/farm_app_implementation_v2.md) | Implementation roadmap for the app build and rollout |
| [implementation/data protection.md](./implementation/data%20protection.md) | Data protection strategy for backups, restores, migrations, and sync safety |
| [implementation/soft-delete-consistency-plan.md](./implementation/soft-delete-consistency-plan.md) | Plan for making soft delete behavior consistent across backend, app, sync, and reporting |

## Project Overview

FarmTrack is a mobile-first farm management application that lets farmers track projects, harvests, sales, and labor.

### Key Features
- **Collaboration:** Invite team members to projects with specific roles (Manager, Viewer) via invite codes.
- **Offline-First:** Full data access and creation without a network connection.
- **Bi-directional Sync:** Automatic synchronization between local database and server.
- **Multilingual Support:** English and Kiswahili (i18n).
- **Yield Tracking:** Record crop yields and calculate revenue from sales.
- **Financial Dashboard:** Real-time summary of costs and revenue.

## Repository Structure

```
Node_Proj/
├── backend/          # Express REST API
├── frontend/         # Expo React Native app
└── docs/             # This documentation
    └── implementation/ # Planning and protection docs
```
