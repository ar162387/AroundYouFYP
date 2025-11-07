/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DATA_PATH = path.resolve(__dirname, '..', 'image_data.json');
const CHUNK_SIZE = 500;

function loadTemplates() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const entries = JSON.parse(raw);

  const templates = [];
  let currentCategory = null;
  const seenNames = new Set();

  entries.forEach((entry) => {
    if (entry.CATEGORY) {
      currentCategory = entry.CATEGORY;
      return;
    }

    if (!entry.src || !entry.alt) {
      return;
    }

    const name = entry.alt.trim();
    if (!name || seenNames.has(name)) {
      return;
    }

    templates.push({
      name,
      image_url: entry.src,
      description: null,
      barcode: null,
      default_unit: null,
      category: currentCategory,
    });
    seenNames.add(name);
  });

  return templates;
}

async function upsertTemplates(templates) {
  for (let i = 0; i < templates.length; i += CHUNK_SIZE) {
    const chunk = templates.slice(i, i + CHUNK_SIZE);
    const payload = chunk.map(({ name, image_url, description, barcode, default_unit }) => ({
      name,
      image_url,
      description,
      barcode,
      default_unit,
    }));

    const { error } = await supabase
      .from('item_templates')
      .upsert(payload, { onConflict: 'name_normalized' });

    if (error) {
      console.error(`Failed to upsert chunk ${i / CHUNK_SIZE + 1}:`, error);
      throw error;
    }

    console.log(`Inserted chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(templates.length / CHUNK_SIZE)}`);
  }
}

async function main() {
  try {
    const templates = loadTemplates();
    console.log(`Preparing ${templates.length} templates for upsert...`);
    await upsertTemplates(templates);
    console.log('All item templates inserted successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main();

