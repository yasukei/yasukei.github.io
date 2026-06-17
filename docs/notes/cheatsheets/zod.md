# Zod

See [Official Document](https://zod.dev/).

## Basic Usage

```typescript
import { z } from "zod";

// define schema
const PlayerSchema = z.object({ 
  username: z.string(),
  xp: z.number()
});
 
// extract the inferred type
type Player = z.infer<typeof PlayerSchema>;
```

---

## 1. Primitive Types

```typescript
z.string();
z.number();
z.bigint();
z.boolean();
z.date();
z.symbol();

// Empty types
z.undefined();
z.null();
z.void(); // accepts undefined

// Catch-all types
z.any();
z.unknown();

// Never type (fails on every validation)
z.never();

```

---

## 2. Strings

String schemas have built-in validation methods.

```typescript
z.string().max(5);
z.string().min(5);
z.string().length(5);

z.string().email();
z.string().url();
z.string().emoji();
z.string().uuid();
z.string().cuid();
z.string().cuid2();
z.string().ulid();

z.string().regex(/^[a-z]+$/);
z.string().includes("tuna");
z.string().startsWith("https://");
z.string().endsWith(".com");
z.string().datetime(); // ISO 8601
z.string().ip(); // defaults to IPv4 and IPv6

```

---

## 3. Numbers

```typescript
z.number().gt(5);   // > 5
z.number().gte(5);  // >= 5
z.number().lt(5);   // < 5
z.number().lte(5);  // <= 5

z.number().int();   // Must be an integer
z.number().positive();   // > 0
z.number().nonnegative();// >= 0
z.number().negative();   // < 0
z.number().nonpositive();// <= 0
z.number().multipleOf(5);

```

---

## 4. Modifiers

You can chain modifiers to allow null/undefined or provide default values.

```typescript
const schema = z.string();

schema.optional(); // string | undefined
schema.nullable(); // string | null
schema.nullish();  // string | null | undefined

// Default values
z.string().default("Guest");
z.number().default(Math.random);

// Catch errors and return a fallback value
z.string().catch("fallback_value");

```

---

## 5. Objects

```typescript
const User = z.object({
  username: z.string(),
  age: z.number().optional(),
});

// Unknown Keys Handling
User.passthrough(); // Keep unknown keys
User.strict();      // Fail if unknown keys are present
User.strip();       // Remove unknown keys (default behavior)

// Object Methods
const PartialUser = User.partial(); // Deep partial by default
const RequiredUser = User.required();

const NameOnly = User.pick({ username: true });
const AgeOnly = User.omit({ username: true });

// Combine objects
const Admin = User.extend({ role: z.literal("ADMIN") });
const Merged = User.merge(z.object({ email: z.string() }));

```

---

## 6. Arrays

```typescript
const stringArray = z.array(z.string());
// equivalent to z.string().array()

stringArray.nonempty(); // Must contain at least one element
stringArray.min(5);     // Minimum 5 elements
stringArray.max(10);    // Maximum 10 elements
stringArray.length(5);  // Exactly 5 elements

```

---

## 7. Enums & Literals

```typescript
// Literal values (exact match)
const tuna = z.literal("tuna");
const twelve = z.literal(12);

// Zod Enums (recommended)
const FishEnum = z.enum(["Salmon", "Tuna", "Trout"]);
FishEnum.parse("Salmon"); // => "Salmon"

// Extract values
FishEnum.options; // ["Salmon", "Tuna", "Trout"]

// Native TypeScript Enums
enum Fruits { Apple, Banana }
const FruitEnum = z.nativeEnum(Fruits);

```

---

## 8. Unions & Intersections

```typescript
// OR (Union)
const stringOrNumber = z.union([z.string(), z.number()]);
// or: z.string().or(z.number())

// Discriminated Unions (better performance for complex objects)
const MyUnion = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.instanceof(Error) }),
]);

// AND (Intersection)
const Person = z.object({ name: z.string() });
const Employee = z.object({ role: z.string() });
const EmployedPerson = z.intersection(Person, Employee);
// or: Person.and(Employee)

```

---

## 9. Records, Tuples, Sets, & Maps

```typescript
// Record: object with unknown keys but specific value types
z.record(z.number()); // Record<string, number>
z.record(z.string().min(1), z.number()); // Record with key validation

// Tuple: fixed length array
z.tuple([z.string(), z.number(), z.boolean()]);

// Set
z.set(z.string());

// Map
z.map(z.string(), z.number());

```

---

## 10. Parsing / Validation Methods

```typescript
const schema = z.string();

// .parse() - Throws an error if invalid
schema.parse("tuna"); // Returns "tuna"
schema.parse(12);     // Throws ZodError

// .safeParse() - Returns an object, DOES NOT throw
const result = schema.safeParse("tuna");
if (result.success) {
  console.log(result.data); // "tuna"
} else {
  console.log(result.error); // ZodError instance
}

```

---

## 11. Type Inference

Extract the TypeScript type from a Zod schema using `z.infer`.

```typescript
const UserSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

type User = z.infer<typeof UserSchema>;
/* type User = {
  name: string;
  age?: number | undefined;
}
*/

```

---

## 12. Custom Validation (`.refine`)

Add custom validation logic.

```typescript
const passwordSchema = z.string().refine((val) => val.length >= 8, {
  message: "Password must be at least 8 characters long",
});

// Advanced refinement (checking multiple fields)
const Form = z.object({
  password: z.string(),
  confirm: z.string()
}).refine((data) => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"], // Sets the error path to the 'confirm' field
});

```

---

## 13. Preprocessing / Coercion

Transform data before parsing or force coercion.

```typescript
// Coercion (automatically convert primitives)
z.coerce.string();  // String(val)
z.coerce.number();  // Number(val)
z.coerce.boolean(); // Boolean(val)
z.coerce.date();    // new Date(val)

// Preprocess (custom transformation BEFORE parsing)
const stringToNumber = z.preprocess(
  (val) => (typeof val === "string" ? parseInt(val, 10) : val),
  z.number()
);

// Transform (custom transformation AFTER parsing)
const nameSchema = z.string().transform((val) => val.toUpperCase());
nameSchema.parse("john"); // => "JOHN"

```
