const Item = require('../models/Item');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

/**
 * Smart Matching Algorithm
 * Scores potential matches between lost and found items based on:
 * 1. Category Match (30 points)
 * 2. Text Similarity (30 points) - Jaccard similarity on title + description tokens
 * 3. Location Proximity (20 points)
 * 4. Time Window (10 points) - Found within 7 days of lost report
 * 5. Tag Overlap (10 points)
 */

// Tokenize and normalize text
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2); // Remove short words
}

// Jaccard similarity between two arrays
function jaccardSimilarity(arr1, arr2) {
  if (arr1.length === 0 && arr2.length === 0) return 0;
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// Calculate match score between a lost and found item
function calculateMatchScore(lostItem, foundItem) {
  let score = 0;
  const breakdown = {};

  // 1. Category Match (35 points)
  if (lostItem.category && foundItem.category && lostItem.category === foundItem.category) {
    score += 35;
    breakdown.category = 35;
  } else {
    breakdown.category = 0;
  }

  // 2. Title Similarity (30 points)
  const lostTitleTokens = tokenize(lostItem.title);
  const foundTitleTokens = tokenize(foundItem.title);
  const titleSimilarity = jaccardSimilarity(lostTitleTokens, foundTitleTokens);
  const titleScore = Math.round(titleSimilarity * 30);
  score += titleScore;
  breakdown.titleSimilarity = titleScore;

  // 3. Description Keyword Overlap (20 points)
  const lostDescTokens = tokenize(lostItem.description);
  const foundDescTokens = tokenize(foundItem.description);
  const descSimilarity = jaccardSimilarity(lostDescTokens, foundDescTokens);
  const descScore = Math.round(descSimilarity * 20);
  score += descScore;
  breakdown.descriptionOverlap = descScore;

  // 4. Location Fuzzy Match (15 points)
  let locationScore = 0;
  if (lostItem.location && foundItem.location) {
    const lostLocDesc = lostItem.location.description || '';
    const foundLocDesc = foundItem.location.description || '';
    
    if (lostLocDesc && foundLocDesc) {
      const locSim = jaccardSimilarity(tokenize(lostLocDesc), tokenize(foundLocDesc));
      locationScore = Math.round(locSim * 15);
    }
  }
  score += locationScore;
  breakdown.location = locationScore;

  return { score: Math.min(score, 100), breakdown };
}

// Find matches for a given item
async function findMatches(item) {
  try {
    // Determine opposite type
    const oppositeType = item.type === 'lost' ? 'found' : 'lost';

    // Find potential candidates
    const candidates = await Item.find({
      type: oppositeType,
      status: 'active',
      postedBy: { $ne: item.postedBy }, // Don't match with own items
    }).populate('postedBy', 'name avatar');

    const matches = [];

    for (const candidate of candidates) {
      const lostItem = item.type === 'lost' ? item : candidate;
      const foundItem = item.type === 'found' ? item : candidate;

      const { score, breakdown } = calculateMatchScore(lostItem, foundItem);

      // Only include matches with score >= 40
      if (score >= 40) {
        // Check if match already exists
        const existingMatch = await Match.findOne({
          lostItem: lostItem._id,
          foundItem: foundItem._id,
        });

        if (!existingMatch) {
          // Create new match record
          const match = new Match({
            lostItem: lostItem._id,
            foundItem: foundItem._id,
            score,
            suggestedBy: 'system',
          });
          await match.save();

          // Notify both parties
          await Notification.create([
            {
              recipient: lostItem.postedBy,
              title: 'New Match Found!',
              message: `A potential match for your lost "${lostItem.title}" has been found.`,
              type: 'MATCH',
              relatedId: match._id,
            },
            {
              recipient: foundItem.postedBy,
              title: 'New Potential Match!',
              message: `Your found item "${foundItem.title}" matches a lost report.`,
              type: 'MATCH',
              relatedId: match._id,
            }
          ]);
        }

        matches.push({
          item: candidate,
          score,
          breakdown,
          matchId: existingMatch?._id,
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
  } catch (error) {
    console.error('Matching service error:', error);
    return [];
  }
}

module.exports = { findMatches, calculateMatchScore };
