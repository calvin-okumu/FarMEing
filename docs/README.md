# FarmTrack — Developer Documentation

This directory contains reference documentation for the FarmTrack full-stack farm management application.

## Contents

| Document | Description |
|---|---|
| [backend.md](./backend.md) | Node.js/Express REST API — models, endpoints, Prisma schema |
| [frontend.md](./frontend.md) | Expo/React Native mobile app — screens, WatermelonDB, sync service, localization |

## Project Overview

FarmTrack is a mobile-first farm management application that lets farmers track projects, harvests, sales, and labor.

### Key Features
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
```
