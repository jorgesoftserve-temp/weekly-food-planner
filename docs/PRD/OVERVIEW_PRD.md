# Recipe Manager & Constraint-Based Weekly Menu Planner

# 1. Project Overview

### Project Name
Weekly Food Planner

## Vision
Build a web app that helps individuals and households organize recipes, generate reproducible weekly meal plans, and create grocery lists.
The core innovation focus of the project is a deterministic constraint-based menu generation engine that considers age groups and food restrictions.

# 2. Problem statement
Meal planning for households is difficult because:
- Different members have different dietary restrictions
- Meal repetition becomes common
- Grocery shopping becomes inefficient
- Fresh ingredients spoil quickly
- Calorie balancing is hard to maintain
- Existing planners rarely support deterministic and testable generation
- Family-friendly menus are hard to do without multiple lists due to family likes/dislike lists and age-approved meals

---

# 3. Goals

## Primary Goals
- Provide recipe management
- Support individual and group meal planning
- Generate weekly menus automatically
- Respect dietary and ingredient constraints
- Produce reproducible outputs
- Generate organized grocery lists

---

# 4. Target users

## Individual Users
Single users who want:
- Weekly meal organization
- Recipe storage
- Grocery list generation
- Dietary tracking

---

## Families & Households
Groups with:
- Shared meals
- Multiple dietary restrictions
- Different calorie needs
- Child/adult meal routines

---

# 5. Core features

## Authentication
- User registration
- Email verification
- Login/Logout
- Password reset
- Group ownership

---

## Group Management
- Household creation
- Member management
- Member roles (creator, admin, member)
- Dietary profiles
- Calorie goals
- Meal frequency routines

---

## Recipe Management
- Recipe CRUD
- Ingredient tracking
- Dietary tagging
- Recipe images
- Shared and member-specific meals

---

## Menu Generation
- 7-day planning
- Constraint validation
- Deterministic generation
- Shared and member-specific meals

---

## Menu & grocery viewing
- In-app menu view (week / day)
- In-app grocery list view (shared + per-member)
- PDF-ready layout (PDF export itself is post-MVP)

---

## Grocery list generation
- Aggregated ingredients
- Freshness-aware grouping
- Shared grocery list
- Member-specific grocery items

---

# 6. MVP Scope

## Included in MVP for 26/06/2026
- Authentication with email verification
- Group support with roles (creator, admin, member)
- Recipe CRUD with images
- Weekly menu generation
- Constraint engine
- Grocery list generation
- Deterministic output
- In-app menu and grocery views (PDF-ready layout)
- Automated tests (Vitest)
- Dockerized local setup

---

## Excluded from MVP for 26/06/2026
- PDF export of menus and grocery lists (planned for next MVP)
- AI recipe generation
- Nutrition APIs
- Real-time collaboration
- Budget optimization
- Shopping integrations
- Inventory tracking
- Calendar synchronization

---

# 7. Core principles

## Deterministic Generation
Same inputs + same seed = same output.

---

## Constraint Safety
Hard dietary restrictions must never be violated.

---

## Modularity
Business logic must remain isolated and testable.

---

# 8. Acceptance criteria

The project is accepted when:
- Users can manage recipes
- Groups and members can be configured
- Menus respect dietary constraints
- Menus are reproducible
- Grocery lists aggregate correctly
- Tests pass in CI
- Project runs through docker compose

---

# 9. Future Expansion ideas
- PDF export (next MVP)
- AI-assisted recipe suggestions
- Smart leftovers optimization
- Pantry inventory management
- Mobile app
- Shopping expenses tracking/optimization
