import { query, getClient, closePool } from "../db";

interface BusinessRow {
  id: string;
  name: string;
  timezone: string;
  status: string;
}

interface ServiceRow {
  id: string;
  business_id: string;
  name: string;
}

// Tailored service offerings according to business type keywords
const SERVICE_CATALOG: Record<string, Array<{ name: string; description: string; price: number }>> = {
  dental: [
    { name: "Teeth Cleaning & Polish", description: "Comprehensive dental prophylaxis and plaque removal", price: 65 },
    { name: "Dental Examination & Consultation", description: "Full oral health assessment and treatment plan", price: 50 },
    { name: "Teeth Whitening Express", description: "Professional fast-acting shade brightening treatment", price: 120 },
    { name: "Fluoride Treatment & Desensitizing", description: "Protective mineral coating for enamel strengthening", price: 40 },
  ],
  medical: [
    { name: "General Health Consultation", description: "Standard physical and medical review with attending physician", price: 60 },
    { name: "Blood Pressure & Vitals Check", description: "Comprehensive vitals checkup and preventive screening", price: 35 },
    { name: "Prescription Renewal & Review", description: "Medication assessment and prescription follow-up", price: 45 },
    { name: "Preventative Wellness Check", description: "Routine health assessment and preventive screening advice", price: 75 },
  ],
  barber: [
    { name: "Signature Haircut", description: "Precision scissor cut, fade, and razor finish with hot towel", price: 35 },
    { name: "Beard Trim & Sculpting", description: "Detailed shaping, trimming, and conditioning with organic oils", price: 25 },
    { name: "Executive Hair & Beard Combo", description: "Full precision haircut, beard trim, and warm facial massage", price: 55 },
    { name: "Express Clean Lineup", description: "Quick edging and neckline cleanup with clipper work", price: 20 },
  ],
  salon: [
    { name: "Express Blowout & Style", description: "Shampoo wash, conditioning, and thermal brush blowdry", price: 45 },
    { name: "Deep Conditioning Therapy", description: "Intense moisture and repair treatment for healthy hair", price: 40 },
    { name: "Gloss & Tone Refresh", description: "Semi-permanent shine boost and color revitalization", price: 65 },
    { name: "Precision Dry Cut", description: "Technical trim and texture refinement on styled dry hair", price: 50 },
  ],
  spa: [
    { name: "Targeted Back Massage", description: "Deep relief for neck, shoulder, and lumbar muscle tension", price: 70 },
    { name: "Express Glow Facial", description: "Quick exfoliation, hydration, and botanical mask rejuvenation", price: 65 },
    { name: "Aromatherapy Relaxation Session", description: "Stress-relieving sensory session using custom essential oils", price: 80 },
    { name: "Reflexology Foot Therapy", description: "Acupressure foot treatment targeting full-body relaxation", price: 55 },
  ],
  fitness: [
    { name: "1-on-1 Fitness Assessment", description: "Movement screening, body composition, and goal setting", price: 45 },
    { name: "Personal Training Session", description: "High-intensity coached workout tailored to your program", price: 50 },
    { name: "Mobility & Recovery Coached Session", description: "Guided foam rolling, assisted stretching, and posture alignment", price: 40 },
    { name: "Nutrition & Meal Strategy Review", description: "Dietary consultation and metabolic strategy plan", price: 60 },
  ],
  auto: [
    { name: "Synthetic Oil Change & Inspection", description: "Premium oil replacement and multi-point safety inspection", price: 75 },
    { name: "Tire Rotation & Pressure Check", description: "Balanced 4-wheel rotation and tread wear inspection", price: 30 },
    { name: "Brake Safety Inspection", description: "Comprehensive check of pads, rotors, drums, and brake fluid", price: 40 },
    { name: "Engine Diagnostic Scan", description: "OBD-II computer diagnostics and sensor performance analysis", price: 50 },
  ],
  general: [
    { name: "Standard 30-Min Consultation", description: "Direct one-on-one session with our senior specialist", price: 50 },
    { name: "Follow-up Review Meeting", description: "Review progress, address questions, and adjust roadmap", price: 35 },
    { name: "Comprehensive Needs Assessment", description: "In-depth review of requirements and tailored action plan", price: 75 },
    { name: "Express Advisory Check-in", description: "Rapid focused check-in for urgent advice and clarity", price: 40 },
  ],
};

function pickCategory(bizName: string): string {
  const lower = bizName.toLowerCase();
  if (lower.includes("dental") || lower.includes("teeth") || lower.includes("dentist")) return "dental";
  if (lower.includes("medical") || lower.includes("clinic") || lower.includes("health") || lower.includes("doc")) return "medical";
  if (lower.includes("barber") || lower.includes("fade") || lower.includes("cut")) return "barber";
  if (lower.includes("salon") || lower.includes("hair") || lower.includes("beauty")) return "salon";
  if (lower.includes("spa") || lower.includes("massage") || lower.includes("wellness")) return "spa";
  if (lower.includes("gym") || lower.includes("fitness") || lower.includes("fit") || lower.includes("train")) return "fitness";
  if (lower.includes("auto") || lower.includes("car") || lower.includes("motor") || lower.includes("mechanic")) return "auto";
  return "general";
}

async function seedOfferings() {
  console.log("🚀 Starting services & hours population for all available businesses...\n");

  try {
    // 1. Fetch all businesses
    const bizRes = await query<BusinessRow>(
      "SELECT id, name, timezone, status FROM platform.businesses ORDER BY created_at ASC;"
    );

    console.log(`Found ${bizRes.rows.length} total businesses in the system.`);

    // Desired service counts per business to ensure natural variety (some 1, some 2, some 3, some 4)
    // E.g. [2, 3, 1, 4, 2, 4, 3, 1, 2, 4]
    const countPattern = [2, 3, 1, 4, 2, 4, 3, 1, 2, 4];

    for (let i = 0; i < bizRes.rows.length; i++) {
      const biz = bizRes.rows[i];
      const targetCount = countPattern[i % countPattern.length];
      const categoryKey = pickCategory(biz.name);
      const catalog = SERVICE_CATALOG[categoryKey] || SERVICE_CATALOG.general;

      console.log(`\n🏢 [${i + 1}/${bizRes.rows.length}] ${biz.name} (Category: ${categoryKey}, Target: ${targetCount} services)`);

      // Check existing services
      const existingServices = await query<ServiceRow>(
        "SELECT id, name FROM booking.services WHERE business_id = $1;",
        [biz.id]
      );

      console.log(`   Current services count: ${existingServices.rows.length}`);

      if (existingServices.rows.length < targetCount) {
        const toAdd = targetCount - existingServices.rows.length;
        const existingNames = new Set(existingServices.rows.map((s) => s.name.toLowerCase()));

        let added = 0;
        for (const item of catalog) {
          if (added >= toAdd) break;
          if (existingNames.has(item.name.toLowerCase())) continue;

          await query(
            `INSERT INTO booking.services (business_id, name, description, duration_minutes, price, is_active)
             VALUES ($1, $2, $3, 30, $4, true);`,
            [biz.id, item.name, item.description, item.price]
          );
          console.log(`   + Added service: "${item.name}" ($${item.price}, 30 min)`);
          added++;
        }
      } else {
        console.log(`   ✓ Already has sufficient services (${existingServices.rows.length}).`);
      }

      // Check and ensure business has working hours configured so slots are bookable
      const hoursRes = await query(
        "SELECT count(*) as count FROM booking.business_hours WHERE business_id = $1;",
        [biz.id]
      );
      const hoursCount = parseInt(hoursRes.rows[0]?.count || "0", 10);

      if (hoursCount < 7) {
        console.log(`   ⚙️ Configuring default working hours (Mon-Sat 09:00-18:00, Sun closed)...`);
        for (let day = 1; day <= 7; day++) {
          const isClosed = day === 7; // Sunday closed, Mon-Sat open
          await query(
            `INSERT INTO booking.business_hours (business_id, day_of_week, open_time, close_time, is_closed)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (business_id, day_of_week) DO UPDATE
             SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = EXCLUDED.is_closed;`,
            [
              biz.id,
              day,
              isClosed ? null : "09:00:00",
              isClosed ? null : "18:00:00",
              isClosed,
            ]
          );
        }
        console.log(`   ✓ Working hours configured.`);
      } else {
        // Ensure at least Monday through Friday are not all closed
        const openCheck = await query(
          "SELECT count(*) as open_count FROM booking.business_hours WHERE business_id = $1 AND is_closed = false;",
          [biz.id]
        );
        const openDays = parseInt(openCheck.rows[0]?.open_count || "0", 10);
        if (openDays === 0) {
          console.log(`   ⚠️ All days were closed. Opening Mon-Fri 09:00-17:00...`);
          for (let day = 1; day <= 5; day++) {
            await query(
              `UPDATE booking.business_hours
               SET open_time = '09:00:00', close_time = '17:00:00', is_closed = false
               WHERE business_id = $1 AND day_of_week = $2;`,
              [biz.id, day]
            );
          }
        }
      }
    }

    console.log("\n✅ All businesses successfully populated with diverse service offerings and valid working hours!");
  } catch (err) {
    console.error("❌ Error seeding service offerings:", err);
  } finally {
    await closePool();
  }
}

seedOfferings();
