# OpenApi.yaml

Here is a quick-reference cheat sheet for writing OpenAPI 3.0/3.1 specifications in YAML.

---

## 1. The Core Structure

Every OpenAPI YAML file follows this foundational skeleton:

```yaml
openapi: 3.1.0
info:
  title: Sample API
  description: A brief description of what your API does.
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
    description: Production server
paths:
  # Your endpoints go here
components:
  # Your reusable definitions go here

```

---

## 2. Paths & Operations (Endpoints)

This is where you define your routes, HTTP methods, parameters, and responses.

```yaml
paths:
  /users/{userId}:
    get:
      summary: Get user by ID
      description: Returns a single user object based on the ID.
      parameters:
        - name: userId
          in: path
          required: true
          description: The numeric ID of the user.
          schema:
            type: integer
        - name: includeDetails
          in: query
          required: false
          schema:
            type: boolean
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
        '404':
          description: User not found

```

### Parameter Locations (`in:`)

* `path`: `/users/{userId}` (Required must be `true`)
* `query`: `/users?page=2`
* `header`: `X-Custom-Header: value`
* `cookie`: `Cookie: debug=0`

---

## 3. Request Bodies (POST/PUT/PATCH)

Use the `requestBody` property to define data sent to the server.

```yaml
paths:
  /users:
    post:
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - email
              properties:
                name:
                  type: string
                  example: Jane Doe
                email:
                  type: string
                  format: email
      responses:
        '201':
          description: Created

```

---

## 4. Reusable Components (`$ref`)

To avoid repeating yourself, define schemas or security types under `components` and reference them using `$ref: '#/components/..._'.`

```yaml
paths:
  /users/{userId}:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        role:
          $ref: '#/components/schemas/UserRole'
          
    UserRole:
      type: string
      enum: [admin, user, guest]

```

---

## 5. Common Data Types & Formats

| Type | Format / Options | Example |
| --- | --- | --- |
| `string` | `format: date` (YYYY-MM-DD)<br>

<br>`format: date-time`<br>

<br>`format: email`<br>

<br>`format: uuid` | `2026-06-19` |
| `integer` | `format: int32` or `int64` | `42` |
| `number` | `format: float` or `double` | `99.99` |
| `boolean` | None | `true` |
| `array` | Requires an `items:` block | `items: { type: string }` |

### Array Example:

```yaml
type: array
items:
  $ref: '#/components/schemas/User'

```

---

## 6. Authentication & Security

Define the strategy in `components.securitySchemes`, then apply it globally or per-route.

```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-KEY
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

# Apply globally to all endpoints:
security:
  - BearerAuth: []

```

> **Tip:** If a specific route doesn't need auth, override it locally in that operation with an empty list: `security: []`.
