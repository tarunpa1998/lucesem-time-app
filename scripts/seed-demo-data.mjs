import postgres from "postgres";
import crypto from "node:crypto";

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {}
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      url.hostname = "aws-0-eu-west-1.pooler.supabase.com";
      url.port = "6543";
      if (url.username === "postgres") {
        url.username = `postgres.${projectRef}`;
      }
      return url.toString();
    }
  } catch {}
  return rawUrl;
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL missing");
const sql = postgres(normalizeUrl(rawUrl), { ssl: "require", max: 3 });

function uid() {
  return crypto.randomUUID();
}

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function run() {
  console.log("🚀 Starting demo data population for Tarun Patel and Patrick Janesch...");

  // 1. Fetch the two users
  const [tarun] =
    await sql`select id, email, display_name from app_users where email ilike 'tarun%'`;
  const [testUser] =
    await sql`select id, email, display_name from app_users where email ilike 'test@lucesem.at'`;

  if (!tarun || !testUser) {
    throw new Error(
      `Could not find both users in database! Tarun: ${!!tarun}, Test: ${!!testUser}`,
    );
  }

  console.log(`Found User 1: ${tarun.display_name} (${tarun.email}, ${tarun.id})`);
  console.log(`Found User 2: ${testUser.display_name} (${testUser.email}, ${testUser.id})`);

  // 2. Create 3 Customers
  const customerDefs = [
    {
      name: "AlpineTech Solutions AG",
      company_number: "FN 512834 w",
      vat_id: "ATU74839201",
      street: "Kärntner Ring 12",
      postal_code: "1010",
      city: "Wien",
      country: "AT",
      contact_person: "Dr. Maximilian Steiner",
      email: "m.steiner@alpinetech.at",
      phone: "+43 1 5123456",
      currency: "EUR",
      time_budget_hours: 450,
      monetary_budget: 65000,
      budget_type: "Total",
    },
    {
      name: "Salzburg Cloud Dynamics GmbH",
      company_number: "FN 489211 b",
      vat_id: "ATU69281034",
      street: "Glanweg 8",
      postal_code: "5020",
      city: "Salzburg",
      country: "AT",
      contact_person: "Katharina Hofer",
      email: "k.hofer@salzburgcloud.at",
      phone: "+43 662 890123",
      currency: "EUR",
      time_budget_hours: 320,
      monetary_budget: 42000,
      budget_type: "Monthly",
    },
    {
      name: "Kärnten Logistik & IoT Partner KG",
      company_number: "FN 392817 k",
      vat_id: "ATU61029384",
      street: "Völkermarkter Straße 45",
      postal_code: "9020",
      city: "Klagenfurt",
      country: "AT",
      contact_person: "Markus Kogler",
      email: "m.kogler@kaernten-logistik.at",
      phone: "+43 463 789012",
      currency: "EUR",
      time_budget_hours: 280,
      monetary_budget: 38000,
      budget_type: "Total",
    },
  ];

  const createdCustomers = [];
  for (const c of customerDefs) {
    const [existing] = await sql`select id from customers where name = ${c.name}`;
    if (existing) {
      createdCustomers.push(existing);
      console.log(`Customer "${c.name}" already exists (${existing.id})`);
    } else {
      const [inserted] = await sql`
        insert into customers (
          name, company_number, vat_id, street, postal_code, city, country,
          contact_person, email, phone, currency, time_budget_hours, monetary_budget, budget_type, is_visible
        ) values (
          ${c.name}, ${c.company_number}, ${c.vat_id}, ${c.street}, ${c.postal_code}, ${c.city}, ${c.country},
          ${c.contact_person}, ${c.email}, ${c.phone}, ${c.currency}, ${c.time_budget_hours}, ${c.monetary_budget}, ${c.budget_type}, true
        ) returning id, name
      `;
      createdCustomers.push(inserted);
      console.log(`Created customer "${c.name}" (${inserted.id})`);
    }
  }

  // 3. Create Projects for these Customers
  const projectDefs = [
    {
      customerId: createdCustomers[0].id,
      name: "Enterprise AI Integration Platform",
      orderNumber: "ALP-2026-AI",
      color: "#009FE3",
      timeBudget: 180,
      moneyBudget: 26100,
      rate: 145,
    },
    {
      customerId: createdCustomers[0].id,
      name: "Cloud Security & Compliance Audit",
      orderNumber: "ALP-2026-SEC",
      color: "#7C3AED",
      timeBudget: 100,
      moneyBudget: 15500,
      rate: 155,
    },
    {
      customerId: createdCustomers[1].id,
      name: "B2B Customer Commerce Portal",
      orderNumber: "SAL-2026-B2B",
      color: "#16A34A",
      timeBudget: 160,
      moneyBudget: 20800,
      rate: 130,
    },
    {
      customerId: createdCustomers[1].id,
      name: "Real-time Telemetry Service",
      orderNumber: "SAL-2026-TEL",
      color: "#D97706",
      timeBudget: 120,
      moneyBudget: 16800,
      rate: 140,
    },
    {
      customerId: createdCustomers[2].id,
      name: "Fleet Tracking API & Hardware Bridge",
      orderNumber: "KNT-2026-FLT",
      color: "#0284C7",
      timeBudget: 170,
      moneyBudget: 22950,
      rate: 135,
    },
  ];

  const createdProjects = [];
  for (const p of projectDefs) {
    const [existing] = await sql`select id, name, customer_id from projects where name = ${p.name}`;
    let projId = existing?.id;
    if (!existing) {
      const [inserted] = await sql`
        insert into projects (
          customer_id, name, order_number, color, time_budget_hours, monetary_budget, hourly_rate,
          is_visible, allow_time_logging, approval_state, created_by
        ) values (
          ${p.customerId}, ${p.name}, ${p.orderNumber}, ${p.color}, ${p.timeBudget}, ${p.moneyBudget}, ${p.rate},
          true, true, 'Approved', ${testUser.id}
        ) returning id, name, customer_id
      `;
      projId = inserted.id;
      createdProjects.push(inserted);
      console.log(`Created project "${p.name}" (${inserted.id})`);
    } else {
      createdProjects.push(existing);
      console.log(`Project "${p.name}" already exists (${existing.id})`);
    }

    // Ensure both users are assigned to this project
    await sql`
      insert into project_users (project_id, user_id)
      values (${projId}, ${tarun.id}), (${projId}, ${testUser.id})
      on conflict do nothing
    `;
  }

  // 4. Create Work Board Tasks for each project
  const taskDefs = [
    // Project 0: Enterprise AI Platform
    {
      projectIdx: 0,
      title: "Set up OAuth2 authentication & permission scopes",
      description:
        "Implement RFC 6749 authorization server integration, token refresh mechanism, and scope claims.",
      status: "closed",
      priority: "high",
      creatorId: testUser.id,
      assignees: [tarun.id, testUser.id],
      comments: [
        {
          userId: testUser.id,
          text: "Let's ensure the token payload supports granular role permissions.",
        },
        { userId: tarun.id, text: "Done. Added signed PBKDF2 claims and 14-day expiry tokens." },
      ],
    },
    {
      projectIdx: 0,
      title: "Implement LangChain vector embeddings pipeline",
      description:
        "Chunk unstructured documents, generate OpenAI text-embedding-3-small vectors, and store in pgvector.",
      status: "in_progress",
      priority: "urgent",
      creatorId: tarun.id,
      assignees: [tarun.id],
      comments: [
        { userId: tarun.id, text: "Chunking algorithm is tested. Processing 500ms batches now." },
      ],
    },
    {
      projectIdx: 0,
      title: "Add benchmark latency metrics & alert dashboards",
      description:
        "Export P95/P99 query response latencies to Grafana and configure notification alerts.",
      status: "pending",
      priority: "medium",
      creatorId: testUser.id,
      assignees: [testUser.id],
      comments: [],
    },

    // Project 1: Cloud Security Audit
    {
      projectIdx: 1,
      title: "Conduct security penetration audit on API endpoints",
      description:
        "Audit OWASP Top 10 vulnerabilities, verify RBAC authorization checks, and test rate-limit policies.",
      status: "closed",
      priority: "urgent",
      creatorId: testUser.id,
      assignees: [testUser.id, tarun.id],
      comments: [
        {
          userId: testUser.id,
          text: "All public endpoints inspected. Zero unauthenticated leakage found.",
        },
      ],
    },
    {
      projectIdx: 1,
      title: "Automate SSL/TLS certificate rotation and cipher hardening",
      description:
        "Configure automated ACME challenge hooks and disable legacy TLS 1.0/1.1 protocols.",
      status: "in_progress",
      priority: "high",
      creatorId: tarun.id,
      assignees: [tarun.id],
      comments: [],
    },

    // Project 2: B2B Commerce Portal
    {
      projectIdx: 2,
      title: "Design responsive dashboard navigation layout",
      description:
        "Create sleek sticky sub-header cards with backdrop blur filters and mobile responsive tabs.",
      status: "closed",
      priority: "medium",
      creatorId: tarun.id,
      assignees: [tarun.id],
      comments: [
        {
          userId: tarun.id,
          text: "Mobile swipeable tabs implemented and tested across viewport sizes.",
        },
      ],
    },
    {
      projectIdx: 2,
      title: "Integrate Stripe payment webhook processing",
      description:
        "Implement webhook receiver with signature validation, idempotent event processing, and customer receipts.",
      status: "in_progress",
      priority: "urgent",
      creatorId: testUser.id,
      assignees: [tarun.id, testUser.id],
      comments: [
        { userId: testUser.id, text: "Check webhook retry handling on network hiccups." },
        {
          userId: tarun.id,
          text: "Added transactional ledger entries to guarantee zero double charges.",
        },
      ],
    },
    {
      projectIdx: 2,
      title: "Build automated PDF invoice generation service",
      description:
        "Generate compliant Austrian UID invoice PDFs client-side with QR payment payload.",
      status: "pending",
      priority: "medium",
      creatorId: testUser.id,
      assignees: [tarun.id],
      comments: [],
    },

    // Project 3: Real-time Telemetry Service
    {
      projectIdx: 3,
      title: "Optimize PostgreSQL indexing for telemetry timeseries",
      description:
        "Add composite indexes on (user_id, entry_date) and evaluate BRIN index performance.",
      status: "closed",
      priority: "high",
      creatorId: tarun.id,
      assignees: [tarun.id],
      comments: [
        { userId: tarun.id, text: "Composite B-Tree index reduced query time from 420ms to 8ms." },
      ],
    },
    {
      projectIdx: 3,
      title: "Implement WebSocket live sync gateway",
      description:
        "Provide bi-directional heartbeat connection for instant state broadcasts across active user tabs.",
      status: "in_progress",
      priority: "urgent",
      creatorId: testUser.id,
      assignees: [tarun.id, testUser.id],
      comments: [],
    },

    // Project 4: Fleet Tracking API
    {
      projectIdx: 4,
      title: "Connect MQTT broker for GPS tracker ingestion",
      description:
        "Handle incoming 10Hz GPS telemetry packets, parse NMEA data, and write to pipeline buffer.",
      status: "closed",
      priority: "high",
      creatorId: tarun.id,
      assignees: [tarun.id],
      comments: [{ userId: tarun.id, text: "MQTT broker connected with TLS client certificates." }],
    },
    {
      projectIdx: 4,
      title: "Implement geofencing boundary polygon calculation",
      description:
        "Calculate point-in-polygon containment checks to alert dispatchers when vehicles exit zones.",
      status: "in_progress",
      priority: "medium",
      creatorId: testUser.id,
      assignees: [tarun.id, testUser.id],
      comments: [],
    },
    {
      projectIdx: 4,
      title: "Build hardware diagnostic battery telemetry alerts",
      description:
        "Monitor low-voltage battery warnings and trigger SMS/Email webhook notifications.",
      status: "pending",
      priority: "low",
      creatorId: testUser.id,
      assignees: [testUser.id],
      comments: [],
    },
  ];

  const createdTasks = [];
  for (const t of taskDefs) {
    const proj = createdProjects[t.projectIdx];
    const [existing] = await sql`
      select id, task_number, title, project_id from board_tasks
      where project_id = ${proj.id} and title = ${t.title}
    `;
    let taskId = existing?.id;
    if (!existing) {
      const [inserted] = await sql`
        insert into board_tasks (
          project_id, title, description, status, priority, created_by, assignee_ids
        ) values (
          ${proj.id}, ${t.title}, ${t.description}, ${t.status}, ${t.priority}, ${t.creatorId}, ${t.assignees}
        ) returning id, task_number, title, project_id
      `;
      taskId = inserted.id;
      createdTasks.push(inserted);
      console.log(`Created task #${inserted.task_number}: "${t.title}" for ${proj.name}`);
    } else {
      createdTasks.push(existing);
      console.log(`Task #${existing.task_number}: "${t.title}" already exists`);
    }

    // Add comments
    for (const c of t.comments) {
      const [existingComment] = await sql`
        select id from board_task_comments
        where task_id = ${taskId} and comment = ${c.text}
      `;
      if (!existingComment) {
        await sql`
          insert into board_task_comments (task_id, user_id, comment)
          values (${taskId}, ${c.userId}, ${c.text})
        `;
      }
    }
  }

  // 5. Generate 2 Full Months of Time Entries (September 1, 2026 to November 2, 2026)
  // Let's iterate day by day
  const startDate = new Date(2026, 8, 1); // 2026-09-01 (month index 8 is September)
  const endDate = new Date(2026, 10, 2); // 2026-11-02 (month index 10 is November)

  console.log(
    `\n📅 Generating realistic working time entries from ${ymd(startDate)} to ${ymd(endDate)}...`,
  );

  // Austrian holidays in this range:
  // Oct 26: Nationalfeiertag
  const holidays = new Set(["2026-10-26"]);

  // Work note templates tied to projects and tasks
  const tarunNotes = [
    "Implemented OAuth2 token signature validation and unit tests",
    "Developed Redis session cache with automatic expiration",
    "Created vector embedding pipeline for unstructured PDF documents",
    "Optimized PostgreSQL queries with composite indexing",
    "Built responsive mobile tab swipe transitions and verified layout",
    "Refactored webhook receiver idempotency logic and database schema",
    "Integrated MQTT sensor broker with mutual TLS authentication",
    "Connected live chronometer timer to work board task state",
    "Fixed date range filtering regression on management reports view",
    "Profiled database query execution plans and eliminated full table scans",
    "Implemented automated unit tests and validated RBAC permission boundaries",
    "Code review, architecture alignment, and daily standup synchronization",
  ];

  const patrickNotes = [
    "Sprint planning, technical architecture alignment, and user story review",
    "Security penetration audit on public API routes and cookie validation",
    "Supervised database migration and verified idempotent execution",
    "Client technical alignment meeting and deliverables presentation",
    "Code review on Stripe webhook idempotency and payment error handling",
    "Configured monitoring alert rules and uptime synthetic heartbeat checks",
    "Reviewed employee timesheet submissions and approved vacation requests",
    "Performance tuning on large PDF export bundle size and chunk loading",
    "Refactored role-based access control guards across admin routes",
    "Technical roadmap planning and quarterly milestone prioritization",
  ];

  const morningStarts = ["08:00", "08:15", "08:30", "08:45"];
  const morningEnds = ["12:00", "12:15", "12:30"];
  const afternoonStarts = ["13:00", "13:15", "13:30"];
  const afternoonEnds = ["16:45", "17:00", "17:15", "17:30", "17:45"];

  let entriesInserted = 0;
  let curr = new Date(startDate);

  while (curr <= endDate) {
    const dayOfWeek = curr.getDay(); // 0 is Sunday, 6 is Saturday
    const dateStr = ymd(curr);

    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const isHoliday = holidays.has(dateStr);

      if (!isHoliday) {
        // Special: Sept 18 is a planned vacation day for Tarun
        const isTarunVacation = dateStr === "2026-09-18";
        // Special: Oct 14 is a sick day for Patrick
        const isPatrickSick = dateStr === "2026-10-14";

        // --- TARUN ENTRIES ---
        if (isTarunVacation) {
          const [exists] = await sql`
            select id from time_entries where user_id = ${tarun.id} and entry_date = ${dateStr}
          `;
          if (!exists) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status
              ) values (
                ${uid()}, ${tarun.id}, ${createdProjects[0].id}, ${dateStr}, '08:30', '16:42',
                'Urlaub (Wanderurlaub in Tirol)', 'Vacation_Urlaub', 'approved'
              )
            `;
            entriesInserted++;
          }
        } else {
          // Morning slot
          const mFrom = morningStarts[Math.floor(Math.random() * morningStarts.length)];
          const mTo = morningEnds[Math.floor(Math.random() * morningEnds.length)];
          const mProj = createdProjects[Math.floor(Math.random() * createdProjects.length)];
          const mTask = createdTasks.filter((t) => t.project_id === mProj.id)[0] || createdTasks[0];
          const mNote = `[#${mTask.task_number}] ${tarunNotes[Math.floor(Math.random() * tarunNotes.length)]}`;

          const [existsMorning] = await sql`
            select id from time_entries where user_id = ${tarun.id} and entry_date = ${dateStr} and from_time = ${mFrom}
          `;
          if (!existsMorning) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status, task_id
              ) values (
                ${uid()}, ${tarun.id}, ${mProj.id}, ${dateStr}, ${mFrom}, ${mTo},
                ${mNote}, 'CustomHours', 'approved', ${mTask.id}
              )
            `;
            entriesInserted++;
          }

          // Afternoon slot
          const aFrom = afternoonStarts[Math.floor(Math.random() * afternoonStarts.length)];
          const aTo = afternoonEnds[Math.floor(Math.random() * afternoonEnds.length)];
          const aProj = createdProjects[Math.floor(Math.random() * createdProjects.length)];
          const aTask = createdTasks.filter((t) => t.project_id === aProj.id)[1] || createdTasks[1];
          const aNote = `[#${aTask.task_number}] ${tarunNotes[Math.floor(Math.random() * tarunNotes.length)]}`;

          const [existsAfternoon] = await sql`
            select id from time_entries where user_id = ${tarun.id} and entry_date = ${dateStr} and from_time = ${aFrom}
          `;
          if (!existsAfternoon) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status, task_id
              ) values (
                ${uid()}, ${tarun.id}, ${aProj.id}, ${dateStr}, ${aFrom}, ${aTo},
                ${aNote}, 'CustomHours', 'approved', ${aTask.id}
              )
            `;
            entriesInserted++;
          }
        }

        // --- PATRICK ENTRIES ---
        if (isPatrickSick) {
          const [exists] = await sql`
            select id from time_entries where user_id = ${testUser.id} and entry_date = ${dateStr}
          `;
          if (!exists) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status
              ) values (
                ${uid()}, ${testUser.id}, ${createdProjects[1].id}, ${dateStr}, '08:00', '16:12',
                'Krankenstand (Grippaler Infekt)', 'SickLeave_Krankenstand', 'approved'
              )
            `;
            entriesInserted++;
          }
        } else {
          // Morning slot
          const mFrom = morningStarts[Math.floor(Math.random() * morningStarts.length)];
          const mTo = morningEnds[Math.floor(Math.random() * morningEnds.length)];
          const mProj = createdProjects[Math.floor(Math.random() * createdProjects.length)];
          const mTask = createdTasks.filter((t) => t.project_id === mProj.id)[0] || createdTasks[0];
          const mNote = `[#${mTask.task_number}] ${patrickNotes[Math.floor(Math.random() * patrickNotes.length)]}`;

          const [existsMorning] = await sql`
            select id from time_entries where user_id = ${testUser.id} and entry_date = ${dateStr} and from_time = ${mFrom}
          `;
          if (!existsMorning) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status, task_id
              ) values (
                ${uid()}, ${testUser.id}, ${mProj.id}, ${dateStr}, ${mFrom}, ${mTo},
                ${mNote}, 'CustomHours', 'approved', ${mTask.id}
              )
            `;
            entriesInserted++;
          }

          // Afternoon slot
          const aFrom = afternoonStarts[Math.floor(Math.random() * afternoonStarts.length)];
          const aTo = afternoonEnds[Math.floor(Math.random() * afternoonEnds.length)];
          const aProj = createdProjects[Math.floor(Math.random() * createdProjects.length)];
          const aTask = createdTasks.filter((t) => t.project_id === aProj.id)[1] || createdTasks[2];
          const aNote = `[#${aTask.task_number}] ${patrickNotes[Math.floor(Math.random() * patrickNotes.length)]}`;

          const [existsAfternoon] = await sql`
            select id from time_entries where user_id = ${testUser.id} and entry_date = ${dateStr} and from_time = ${aFrom}
          `;
          if (!existsAfternoon) {
            await sql`
              insert into time_entries (
                id, user_id, project_id, entry_date, from_time, to_time,
                work_notes, entry_mode, status, task_id
              ) values (
                ${uid()}, ${testUser.id}, ${aProj.id}, ${dateStr}, ${aFrom}, ${aTo},
                ${aNote}, 'CustomHours', 'approved', ${aTask.id}
              )
            `;
            entriesInserted++;
          }
        }
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  // 6. Summary stats
  console.log(`\n✅ Finished! Inserted ${entriesInserted} new time entries.`);

  const [tCount] =
    await sql`select count(*) as count from time_entries where user_id = ${tarun.id}`;
  const [pCount] =
    await sql`select count(*) as count from time_entries where user_id = ${testUser.id}`;
  const [totalHours] = await sql`
    select round(sum(extract(epoch from (to_time - from_time))) / 3600.0, 2) as total
    from time_entries
  `;

  console.log(`📊 Total time entries for Tarun Patel: ${tCount.count}`);
  console.log(`📊 Total time entries for Patrick Janesch: ${pCount.count}`);
  console.log(`⏱ Total hours logged across all projects: ${totalHours.total}h`);

  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
