import { normalizeUrl } from '../lib/url.js';

function cleanString(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function uniqueEmails(values = []) {
  const seen = new Set();
  const emails = [];

  values.forEach((value) => {
    const email = cleanString(value).toLowerCase();
    if (!email || seen.has(email)) {
      return;
    }

    seen.add(email);
    emails.push(email);
  });

  return emails;
}

function toNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCoordinates(place) {
  const lat = toNumber(place.latitude ?? place.lat);
  const lng = toNumber(place.longtitude ?? place.longitude ?? place.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getEmails(place) {
  if (Array.isArray(place.emails)) {
    return uniqueEmails(place.emails);
  }

  const single = cleanString(place.email);
  return single ? uniqueEmails([single]) : [];
}

function getAddress(place) {
  const direct = cleanString(place.address);
  if (direct) {
    return direct;
  }

  if (typeof place.complete_address === 'string') {
    return cleanString(place.complete_address);
  }

  if (!place.complete_address || typeof place.complete_address !== 'object') {
    return '';
  }

  const parts = [
    place.complete_address.street,
    place.complete_address.city,
    place.complete_address.state,
    place.complete_address.postal_code,
    place.complete_address.country
  ]
    .map(cleanString)
    .filter(Boolean);

  return parts.join(', ');
}

function buildDedupeKey(lead) {
  if (lead.placeId) {
    return `place:${lead.placeId}`;
  }

  if (lead.cid) {
    return `cid:${lead.cid}`;
  }

  if (lead.website) {
    return `website:${lead.website}`;
  }

  const fingerprint = [lead.name, lead.address]
    .map((value) => cleanString(value).toLowerCase())
    .filter(Boolean)
    .join('|');

  return fingerprint ? `fingerprint:${fingerprint}` : '';
}

function leadRichnessScore(lead) {
  let score = 0;
  const weights = [
    lead.website,
    lead.phone,
    lead.email,
    lead.address,
    lead.placeId,
    lead.mapsUrl,
    lead.coordinates
  ];

  weights.forEach((value) => {
    if (value) {
      score += 1;
    }
  });

  if (lead.reviews) {
    score += 2;
  }

  if (lead.rating) {
    score += 1;
  }

  if (Array.isArray(lead.categories) && lead.categories.length > 0) {
    score += 1;
  }

  return score;
}

function normalizePlace(place, context = {}) {
  const name = cleanString(place.title ?? place.name);
  const address = getAddress(place);
  const website = normalizeUrl(place.web_site ?? place.website ?? '');
  const emails = getEmails(place);
  const completeAddress = typeof place.complete_address === 'string'
    ? cleanString(place.complete_address)
    : (place.complete_address && typeof place.complete_address === 'object'
      ? getAddress({ complete_address: place.complete_address })
      : '');
  const lead = {
    name,
    address,
    phone: cleanString(place.phone),
    website: website || null,
    email: emails[0] || null,
    emails,
    rating: toNumber(place.review_rating ?? place.rating),
    reviews: toInteger(place.review_count ?? place.reviews ?? place.ratingCount),
    placeId: cleanString(place.place_id ?? place.placeId ?? place.cid),
    cid: cleanString(place.cid),
    mapsUrl: cleanString(place.link ?? place.maps_url),
    completeAddress: completeAddress || null,
    coordinates: getCoordinates(place),
    categories: Array.isArray(place.categories)
      ? place.categories.map(cleanString).filter(Boolean)
      : [cleanString(place.category)].filter(Boolean),
    source: 'google-maps-scraper',
    sourceMetadata: {
      query: context.query || null,
      cid: cleanString(place.cid),
      dataId: cleanString(place.data_id),
      rawStatus: cleanString(place.status),
      mapsUrl: cleanString(place.link ?? place.maps_url),
      completeAddress: completeAddress || null,
      categories: Array.isArray(place.categories)
        ? place.categories.map(cleanString).filter(Boolean)
        : [cleanString(place.category)].filter(Boolean)
    }
  };

  const errors = [];
  if (!lead.name) {
    errors.push('missing_name');
  }

  if (!lead.placeId && !lead.website && !lead.phone && !lead.address) {
    errors.push('missing_contact_fields');
  }

  const dedupeKey = buildDedupeKey(lead);
  if (!dedupeKey) {
    errors.push('missing_dedupe_key');
  }

  return {
    lead,
    dedupeKey,
    errors
  };
}

export function normalizeMapsPlaces(rawPlaces = [], options = {}) {
  const leadsByKey = new Map();
  const invalidRows = [];
  const duplicates = [];

  rawPlaces.forEach((place, index) => {
    const { lead, dedupeKey, errors } = normalizePlace(place, options);
    if (errors.length > 0) {
      invalidRows.push({
        rowIndex: index,
        errors,
        raw: place
      });
      return;
    }

    const existing = leadsByKey.get(dedupeKey);
    if (!existing) {
      leadsByKey.set(dedupeKey, {
        ...lead,
        dedupeKey
      });
      return;
    }

    duplicates.push({
      dedupeKey,
      kept: existing.name,
      discarded: lead.name
    });

    if (leadRichnessScore(lead) > leadRichnessScore(existing)) {
      leadsByKey.set(dedupeKey, {
        ...lead,
        dedupeKey
      });
    }
  });

  let normalizedLeads = Array.from(leadsByKey.values());
  if (options.limit && Number.isFinite(options.limit)) {
    normalizedLeads = normalizedLeads.slice(0, options.limit);
  }

  return {
    leads: normalizedLeads,
    invalidRows,
    duplicates,
    counts: {
      raw: rawPlaces.length,
      normalized: normalizedLeads.length,
      invalid: invalidRows.length,
      duplicates: duplicates.length
    }
  };
}
