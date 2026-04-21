# Database Paradigm Selection

*With reference to Designing Data-Intensive Applications by Martin Kleppmann*

Kleppmann's core argument is that **there is no universally best database** — only tradeoffs that fit or don't fit your access patterns. The thought process is a series of questions:

---

## 1. What is the shape of your data?

Kleppmann introduces this in Chapter 2 (*Data Models and Query Languages*).

**Ask: does your data have a natural structure?**

- **Highly interconnected, many relationships** → Relational (or Graph)
- **Self-contained documents with locality** (e.g., a user profile with embedded addresses) → Document
- **Deeply connected traversals** (social graphs, fraud detection, recommendations) → Graph
- **Flat, append-only facts** → Column-store or time-series

The "impedance mismatch" concept is key here — if your application objects map awkwardly to tables (lots of joins to reconstitute one object), that's a signal the relational model is fighting your data shape.

---

## 2. What are your read/write access patterns?

Chapter 3 (*Storage and Retrieval*) underpins this.

| Pattern | Signal |
|---|---|
| Point lookups by primary key | Any model works; hash index sufficient |
| Range queries (e.g., time windows) | B-tree / sorted indexes; relational or column-store |
| Full-text search | Inverted index (Elasticsearch, Postgres tsvector) |
| Write-heavy, high throughput | LSM-tree backed (Cassandra, RocksDB) |
| Read-heavy analytics | Column-oriented (BigQuery, Redshift, DuckDB) |
| Graph traversal | Graph DB (Neo4j) or recursive CTEs in Postgres |

The insight is that **OLTP vs OLAP** is a fundamental fork in the road — trying to serve both from one system is where products typically run into trouble.

---

## 3. What consistency and transaction guarantees do you need?

Chapters 7 (*Transactions*) and 9 (*Consistency and Consensus*) are the most nuanced part of the book.

**Ask: what happens if two writes conflict, or a node fails mid-operation?**

- If correctness requires **atomicity across multiple records** → You need ACID transactions → Relational (Postgres, MySQL) or NewSQL (CockroachDB, Spanner)
- If you can tolerate **eventual consistency** and want horizontal write scale → Leaderless/multi-leader (Cassandra, DynamoDB)
- If you need **strong consistency at global scale** → Spanner-class systems (expensive)

Kleppmann is blunt: many NoSQL systems traded away consistency for scalability, and most applications quietly need more consistency than they admit. **Default to stronger guarantees; weaken only when you have a measured reason.**

---

## 4. What are your scaling requirements — and are they real?

Chapter 5 (*Replication*) and Chapter 6 (*Partitioning*) are relevant here.

A common mistake is choosing Cassandra or MongoDB for "scalability" before hitting any scale problem. Kleppmann implicitly warns against this.

**Ask:**
- What is your actual write throughput today and in 12 months?
- Do you need **read replicas** (most products) or **sharding** (far fewer products)?
- Can you vertically scale first? A well-tuned Postgres instance handles enormous load.

Premature distribution introduces **partial failure modes, clock skew, split-brain** — problems you don't have with a single-node RDBMS.

---

## 5. What are your schema evolution needs?

Chapter 4 (*Encoding and Evolution*) covers this.

- **Schema-on-write** (relational): migrations required; more discipline, more safety
- **Schema-on-read** (document): flexible, but validation burden moves to the application

If your data model is still being discovered (early product), document DBs tolerate change more cheaply. Once the model stabilizes, the lack of enforced schema becomes a liability, not an asset.

---

## The Mental Decision Tree

```
Is data highly relational/interconnected?
├── Yes, deeply traversed graphs → Graph DB
├── Yes, standard relations + ACID needed → Relational (Postgres)
└── No → Is it read-heavy analytics?
    ├── Yes → Column-store (BigQuery, DuckDB)
    └── No → Is it self-contained documents?
        ├── Yes, with high write scale + eventual consistency OK → Document/Wide-column
        └── Yes, with consistency needed → Relational with JSONB
```

---

## The Meta-Principle

Kleppmann's deeper point is: **understand the guarantees your system actually provides, not the marketing**. Many systems claim to be "consistent" or "scalable" but define those terms differently. Read the fine print on isolation levels, replication lag, and failure behavior — then match to what your product actually needs.

For most products, **Postgres is the right default** until you have a concrete, measured reason to diverge.
