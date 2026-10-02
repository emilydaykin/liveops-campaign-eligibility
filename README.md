# LiveOps Campaign Eligibility

A small HTTP service that checks which players are eligible for a campaign and stores that evaluation so it can be read back later.

**Table of contents:**

1. [Problem statement](#1-problem-statement)
2. [Local setup](#2-local-setup)
3. [API](#3-api)
4. [How to run](#4-how-to-run)
5. [Decisions & tradeoffs](#5-decisions--tradeoffs)
6. [Assumptions](#6-assumptions)
7. [Tests](#7-tests)
8. [What I'd do with more time](#8-what-id-do-with-more-time)

## 1. Problem statement

#### Scenario
A LiveOps team wants to send an in-game campaign to a selected group of players. A campaign defines a minimum level and the countries in which it is available. Build a backend service that determines which supplied players are eligible and records that a campaign was evaluated for them.

#### Context
Campaign rules may change while the service is running. Previously stored eligibility results must reflect the current campaign rules when retrieved. A campaign evaluation may be requested again with the same evaluationId.

#### Task
* Accept a campaign evaluation request containing an evaluationId, campaign rules, and a list of player IDs.
* For each supplied player, determine whether the player meets the campaign rules.
* Store an evaluation result once per evaluationId.
* Expose a stored evaluation result by evaluationId.
* Return suitable HTTP responses for invalid requests and unknown player IDs.

#### Service Interface
* POST /campaign-evaluations: evaluates a campaign for players.
* GET /campaign-evaluations/{evaluationId}: returns a stored evaluation.

#### Example Campaign Rules 
```
{
  "campaignId": "summer-boost",
  "minimumLevel": 10,
  "countries": ["ES", "SE"]
}
```

#### Fixture Data
Player profiles available to the service (in-memory fixture, since persistence is not required): 
```
[
  {"playerId":"p-42", "country":"ES", "level":18, "lastActiveAt":"2026-08-21T09:00:00Z"},
  {"playerId":"p-77", "country":"SE", "level":6, "lastActiveAt":"2026-08-17T12:15:00Z"},
  {"playerId":"p-88", "country":"ES", "level":10, "lastActiveAt":"2026-08-20T20:30:00Z"},
  {"playerId":"p-99", "country":"SE", "level":11, "lastActiveAt":"2026-08-22T08:45:00Z"},
  {"playerId":"p-101", "country":"FR", "level":20, "lastActiveAt":"2026-08-22T14:10:00Z"},
  {"playerId":"p-102", "country":"DE", "level":9, "lastActiveAt":"2026-08-19T16:25:00Z"}
]
```

#### Note on eligibility:
A player is eligible when their country is in the campaign's country list AND their level is greater than or equal to the campaign's minimumLevel.

## 2. Local setup

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev
```

The server listens on `http://localhost:3000`.

See Section [4. How to run](#4-how-to-run) for examples.

`npm run test` runs the test suite. 

## 3. API

### POST /campaign-evaluations

Evaluates a campaign for the given players and stores the evaluation. The endpoint is idempotent per `evaluationId` (see [Repeated requests](#repeated-requests)).

Eligible means the player's country is in `countries` and their level is greater than or equal to `minimumLevel`.

```json
{
  "evaluationId": "batch-a",
  "campaign": {
    "campaignId": "summer-boost",
    "minimumLevel": 10,
    "countries": ["ES", "SE"]
  },
  "playerIds": ["p-42", "p-77"]
}
```

`201` response:

```json
{
  "evaluationId": "batch-a",
  "campaignId": "summer-boost",
  "results": [
    { "playerId": "p-42", "eligible": true },
    { "playerId": "p-77", "eligible": false }
  ]
}
```

`p-42` is level 18 in ES. `p-77` is level 6 in SE.

#### Repeated requests

The brief says an evaluation "may be requested again with the same evaluationId" and must be stored "once per evaluationId". I read that as idempotency: a client can safely retry. A retry never replaces the stored evaluation (`campaignId` and `playerIds`). Campaign rules are stored separately, so a matching retry with different rules updates those rules and the response uses them.

| Request with an existing `evaluationId` | Result |
| --- | --- |
| Same `campaignId` and same `playerIds` (in any order) | `200` with the stored evaluation. Nothing new is stored |
| Same as above, but different campaign rules | `200`. The campaign's rules are updated, like on any POST, and the results use them |
| Different `campaignId` or different `playerIds` | `409 Conflict`. The stored evaluation and the campaign rules are left unchanged |

The first POST for an `evaluationId` returns `201`.

A changed player list is rejected rather than silently replaced or ignored, because either would hide a client bug: the client would think its new list was evaluated and stored.

### GET /campaign-evaluations/{evaluationId}

Returns the stored evaluation using the campaign's current rules.

`200` uses the same body as POST. `404` if that `evaluationId` was never stored:

```json
{ "error": "Evaluation not found: batch-a" }
```

### Errors

| Status | When |
| --- | --- |
| 400 | Body is malformed JSON or not a JSON object, or a required field is missing or has the wrong type |
| 404 | `evaluationId` was never stored |
| 409 | `evaluationId` already exists with a different `campaignId` or `playerIds` |
| 422 | The request is valid, but at least one `playerId` is unknown |

All error bodies are JSON with an `error` field.

Unknown players fail the whole request with `422`. The request is well-formed, but it refers to players that do not exist, which `422 Unprocessable Content` describes better than a generic `400`. The body includes the bad ids:

```json
{
  "error": "Unknown player IDs: p-404",
  "playerIds": ["p-404"]
}
```

Send `Content-Type: application/json`. Without that header the body is not parsed, and the request fails with `400`.

See Section [4. How to run](#4-how-to-run) for examples.

## 4. How to run

Run these in order with the server from Section [2. Local setup](#2-local-setup). The last GET shows `batch-a` after the same campaign's rules change. Restart `npm run dev` to start over; state is in memory.

> [!NOTE]
> The commands use `jq` to format the JSON, so it needs to be installed (e.g. `brew install jq`). 
> `curl -s` prints the body only. The `201` and `200` below are what the server sends, so they do not appear in the output.

#### 1. Create a campaign evaluation for `batch-a` (POST):

<details>
<summary>curl command</summary>

```bash
curl -s -X POST http://localhost:3000/campaign-evaluations \
  -H 'Content-Type: application/json' \
  -d '{
    "evaluationId": "batch-a",
    "campaign": {
      "campaignId": "summer-boost",
      "minimumLevel": 10,
      "countries": ["ES", "SE"]
    },
    "playerIds": ["p-42", "p-77"]
  }' | jq
```

</details>

<details>
<summary>Expected response</summary>

Should return `201`. `p-42` is eligible. `p-77` is not.

```json
{
  "evaluationId": "batch-a",
  "campaignId": "summer-boost",
  "results": [
    { "playerId": "p-42", "eligible": true },
    { "playerId": "p-77", "eligible": false }
  ]
}
```

</details>



#### 2. Request the campaign evaluation for `batch-a` (GET):

<details>
<summary>curl command</summary>

```bash
curl -s http://localhost:3000/campaign-evaluations/batch-a | jq
```
</details>

<details>
<summary>Expected response</summary>

You should see the same body, `200`.

```json
{
  "evaluationId": "batch-a",
  "campaignId": "summer-boost",
  "results": [
    { "playerId": "p-42", "eligible": true },
    { "playerId": "p-77", "eligible": false }
  ]
}
```

</details>

#### 3. Lower the same campaign's `minimumLevel` with a new evaluation (POST):

<details>
<summary>curl command</summary>

```bash
curl -s -X POST http://localhost:3000/campaign-evaluations \
  -H 'Content-Type: application/json' \
  -d '{
    "evaluationId": "batch-b",
    "campaign": {
      "campaignId": "summer-boost",
      "minimumLevel": 5,
      "countries": ["ES", "SE"]
    },
    "playerIds": ["p-42", "p-77"]
  }' | jq
```

</details>

<details>
<summary>Expected response</summary>

Should return `201`. Both players are eligible under the new rules.

```json
{
  "evaluationId": "batch-b",
  "campaignId": "summer-boost",
  "results": [
    { "playerId": "p-42", "eligible": true },
    { "playerId": "p-77", "eligible": true }
  ]
}
```
</details>

#### 4. Request the campaign evaluation for `batch-a` again (GET):

<details>
<summary>curl command</summary>

```bash
curl -s http://localhost:3000/campaign-evaluations/batch-a | jq
```

</details>

<details>
<summary>Expected response</summary>

Should return `200`. `p-77` is now eligible. `batch-a` still lists the same players; the result uses the campaign's current rules.


```json
{
  "evaluationId": "batch-a",
  "campaignId": "summer-boost",
  "results": [
    { "playerId": "p-42", "eligible": true },
    { "playerId": "p-77", "eligible": true }
  ]
}
```

</details>

## 5. Decisions & tradeoffs

| Choice | Instead of | Why |
| --- | --- | --- |
| Store `campaignId` and `playerIds` only | Saving each player's `eligible` flag | Saving the flag would freeze each player's answer from the first POST. The brief says a later GET must use the campaign's current rules |
| One shared rules map per `campaignId` | A copy of the rules on each evaluation | A copy would keep each evaluation on the rules from when it was stored. The brief says a later read must use the current rules |
| The same `evaluationId` is a retry | Replacing the stored campaign or player list | A retry of the same campaign and players can be sent again safely. Replacing them would make the client think its new list had been stored. See [Repeated requests](#repeated-requests) |
| In-memory state | A database | The brief does not require campaign rules or evaluations to survive a restart, so a database is unnecessary. Player profiles are in the source and are loaded again on startup |
| Ignore `lastActiveAt` | Treating it as part of eligibility | The brief defines eligibility as country and level only. A recency check isn't needed |
| TypeScript and Express | Java | I am more familiar with TypeScript and Express than Java |
| Checking the body manually | A schema validation library | For this small prototype, a library is not worth a dependency for these few fields |
| Vitest and Supertest | Node's built-in test runner | Imports end in `.js` while the files are `.ts`, which Node's runner cannot load. Vitest can. Vitest's syntax is arguably more readable, and Supertest calls the app in the test so no port needs to be opened |

## 6. Assumptions

- "Current campaign rules" means one shared rule set per `campaignId`, not a copy stored on each evaluation.
- Country matching is an exact, case-sensitive string match.
- An empty `playerIds` array is valid. A non-array is not.
- `minimumLevel` must be an integer greater than or equal to 0, since player levels are whole numbers.
- `countries` must be a non-empty array of strings. `playerIds` must be an array of strings.
- If any supplied player id is unknown, the whole request is rejected and nothing is stored.
- Duplicate player IDs are ignored. Each player is evaluated once, in order of first appearance.
- Two requests are "the same evaluation" when `campaignId` matches and `playerIds` contain the same ids, _in any order_. A repeat returns results in the order of the first stored request.

## 7. Tests

`npm test` uses Vitest. Eligibility is a unit test. The HTTP tests use Supertest against the Express app, with no open port.

They cover eligible and ineligible players, invalid and wrongly typed fields, malformed JSON, unknown player ids, idempotent repeats and conflicting repeats of an `evaluationId`, an unknown `evaluationId`, and a GET that picks up campaign rules changed by a later POST.

## 8. What I'd do with more time

- Accept an `Idempotency-Key` header instead of relying on `evaluationId` alone, if clients need to retry other endpoints too.

If this were to **scale** to a **production-ready** service, I would:

- Store campaign rules and evaluations in a database so they survive restarts and are shared across instances. The in-memory maps only work for one process.
- Split rule updates from evaluations. A POST that checks players should not be the way rules change for every other evaluation.
- Load player profiles from a player service instead of the fixture.
- Require authentication so only the LiveOps tools can create evaluations or change rules.
- Record who changed a campaign's rules and when, so a GET that flips eligibility can be explained later.
