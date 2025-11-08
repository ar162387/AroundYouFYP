/**
 * Unit Tests for Delivery Tiering Calculation Logic
 * 
 * This test suite tests the business logic functions that calculate
 * delivery fees based on distance tiers, order values, and free delivery rules.
 * 
 * Run with: npx ts-node testsprite_tests/backend/delivery-tiering-calculation.test.ts
 * 
 * Note: These functions are copied from deliveryLogicService.ts to avoid
 * React Native dependencies in the test environment.
 */

// Types (copied from service)
type DistanceTier = {
  max_distance: number; // in meters
  fee: number; // in PKR
};

type DeliveryLogic = {
  id: string;
  shopId: string;
  minimumOrderValue: number;
  smallOrderSurcharge: number;
  leastOrderValue: number;
  distanceMode: 'auto' | 'custom';
  maxDeliveryFee: number;
  distanceTiers: DistanceTier[];
  beyondTierFeePerUnit: number;
  beyondTierDistanceUnit: number;
  freeDeliveryThreshold: number;
  freeDeliveryRadius: number;
  createdAt: string;
  updatedAt: string;
};

// Calculation functions (copied from deliveryLogicService.ts)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function calculateDeliveryFee(
  distanceInMeters: number,
  logic: DeliveryLogic
): number {
  const tiers = logic.distanceTiers.sort((a, b) => a.max_distance - b.max_distance);
  
  // Find matching tier
  for (const tier of tiers) {
    if (distanceInMeters <= tier.max_distance) {
      return Math.min(tier.fee, logic.maxDeliveryFee);
    }
  }

  // Beyond all tiers - calculate extra fee
  const lastTier = tiers[tiers.length - 1];
  const extraDistance = distanceInMeters - lastTier.max_distance;
  const extraUnits = Math.ceil(extraDistance / logic.beyondTierDistanceUnit);
  const totalFee = lastTier.fee + (extraUnits * logic.beyondTierFeePerUnit);

  return Math.min(totalFee, logic.maxDeliveryFee);
}

function checkFreeDelivery(
  orderValue: number,
  distanceInMeters: number,
  logic: DeliveryLogic
): boolean {
  return (
    orderValue >= logic.freeDeliveryThreshold &&
    distanceInMeters <= logic.freeDeliveryRadius
  );
}

function calculateOrderSurcharge(orderValue: number, logic: DeliveryLogic): number {
  if (orderValue < logic.minimumOrderValue) {
    return logic.smallOrderSurcharge;
  }
  return 0;
}

function validateOrderValue(orderValue: number, logic: DeliveryLogic): {
  valid: boolean;
  message?: string;
} {
  if (orderValue < logic.leastOrderValue) {
    return {
      valid: false,
      message: `Minimum item value is Rs ${logic.leastOrderValue.toFixed(0)}`,
    };
  }
  return { valid: true };
}

function calculateTotalDeliveryFee(
  orderValue: number,
  distanceInMeters: number,
  logic: DeliveryLogic
): {
  baseFee: number;
  surcharge: number;
  freeDeliveryApplied: boolean;
  finalFee: number;
} {
  // Check free delivery first
  const freeDeliveryApplied = checkFreeDelivery(orderValue, distanceInMeters, logic);
  
  if (freeDeliveryApplied) {
    return {
      baseFee: 0,
      surcharge: 0,
      freeDeliveryApplied: true,
      finalFee: 0,
    };
  }

  // Calculate base delivery fee from distance
  const baseFee = calculateDeliveryFee(distanceInMeters, logic);

  // Calculate order value surcharge
  const surcharge = calculateOrderSurcharge(orderValue, logic);

  return {
    baseFee,
    surcharge,
    freeDeliveryApplied: false,
    finalFee: baseFee + surcharge,
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

// Helper to create test delivery logic
function createTestLogic(overrides?: Partial<DeliveryLogic>): DeliveryLogic {
  const defaultTiers: DistanceTier[] = [
    { max_distance: 200, fee: 20 },
    { max_distance: 400, fee: 30 },
    { max_distance: 600, fee: 40 },
    { max_distance: 800, fee: 50 },
    { max_distance: 1000, fee: 60 }
  ];

  return {
    id: 'test-id',
    shopId: 'test-shop-id',
    minimumOrderValue: 200,
    smallOrderSurcharge: 40,
    leastOrderValue: 100,
    distanceMode: 'auto',
    maxDeliveryFee: 130,
    distanceTiers: defaultTiers,
    beyondTierFeePerUnit: 10,
    beyondTierDistanceUnit: 250,
    freeDeliveryThreshold: 800,
    freeDeliveryRadius: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

// Test Suite: Distance Calculation (Haversine Formula)
function testCalculateDistance() {
  console.log('\n=== Test: Calculate Distance (Haversine) ===');

  // Test: Same location
  const sameLocation = calculateDistance(24.8607, 67.0011, 24.8607, 67.0011);
  logTest('Distance: Same Location', sameLocation === 0, 
    sameLocation === 0 ? undefined : `Expected 0, got ${sameLocation}`,
    { distance: sameLocation }
  );

  // Test: Known distance (Karachi to approximate nearby point)
  // Using approximate coordinates - actual distance should be small
  const distance1 = calculateDistance(24.8607, 67.0011, 24.8610, 67.0015);
  logTest('Distance: Small Distance', distance1 > 0 && distance1 < 1000,
    distance1 > 0 && distance1 < 1000 ? undefined : `Unexpected distance: ${distance1}m`,
    { distance: distance1 }
  );

  // Test: Larger distance (should be reasonable)
  const distance2 = calculateDistance(24.8607, 67.0011, 24.9000, 67.0500);
  logTest('Distance: Larger Distance', distance2 > 1000 && distance2 < 10000,
    distance2 > 1000 && distance2 < 10000 ? undefined : `Unexpected distance: ${distance2}m`,
    { distance: distance2 }
  );
}

// Test Suite: Delivery Fee Calculation Based on Tiers
function testCalculateDeliveryFee() {
  console.log('\n=== Test: Calculate Delivery Fee ===');

  const logic = createTestLogic();

  // Test: Distance within first tier (≤ 200m)
  const fee1 = calculateDeliveryFee(150, logic);
  logTest('Fee: Within First Tier (150m)', fee1 === 20,
    fee1 === 20 ? undefined : `Expected 20, got ${fee1}`,
    { distance: 150, fee: fee1, expected: 20 }
  );

  // Test: Distance at tier boundary (200m)
  const fee2 = calculateDeliveryFee(200, logic);
  logTest('Fee: At Tier Boundary (200m)', fee2 === 20,
    fee2 === 20 ? undefined : `Expected 20, got ${fee2}`,
    { distance: 200, fee: fee2, expected: 20 }
  );

  // Test: Distance in second tier (201-400m)
  const fee3 = calculateDeliveryFee(300, logic);
  logTest('Fee: Second Tier (300m)', fee3 === 30,
    fee3 === 30 ? undefined : `Expected 30, got ${fee3}`,
    { distance: 300, fee: fee3, expected: 30 }
  );

  // Test: Distance in middle tier (401-600m)
  const fee4 = calculateDeliveryFee(500, logic);
  logTest('Fee: Middle Tier (500m)', fee4 === 40,
    fee4 === 40 ? undefined : `Expected 40, got ${fee4}`,
    { distance: 500, fee: fee4, expected: 40 }
  );

  // Test: Distance in last tier (801-1000m)
  const fee5 = calculateDeliveryFee(900, logic);
  logTest('Fee: Last Tier (900m)', fee5 === 60,
    fee5 === 60 ? undefined : `Expected 60, got ${fee5}`,
    { distance: 900, fee: fee5, expected: 60 }
  );

  // Test: Distance beyond last tier (1001m+)
  // Should calculate: 60 (last tier) + ceil((1200-1000)/250) * 10 = 60 + 1 * 10 = 70
  const fee6 = calculateDeliveryFee(1200, logic);
  const expectedFee6 = 60 + Math.ceil((1200 - 1000) / 250) * 10; // 70
  logTest('Fee: Beyond Last Tier (1200m)', fee6 === expectedFee6,
    fee6 === expectedFee6 ? undefined : `Expected ${expectedFee6}, got ${fee6}`,
    { distance: 1200, fee: fee6, expected: expectedFee6 }
  );

  // Test: Distance way beyond last tier with max cap
  // 2000m: 60 + ceil((2000-1000)/250) * 10 = 60 + 4 * 10 = 100, but capped at 130
  const fee7 = calculateDeliveryFee(2000, logic);
  logTest('Fee: Way Beyond Last Tier (2000m)', fee7 <= 130,
    fee7 <= 130 ? undefined : `Fee ${fee7} exceeds max ${130}`,
    { distance: 2000, fee: fee7, maxFee: 130 }
  );

  // Test: Max delivery fee cap
  const logicWithLowMax = createTestLogic({ maxDeliveryFee: 50 });
  const fee8 = calculateDeliveryFee(900, logicWithLowMax);
  logTest('Fee: Max Fee Cap Applied', fee8 === 50,
    fee8 === 50 ? undefined : `Expected 50 (capped), got ${fee8}`,
    { distance: 900, fee: fee8, maxFee: 50, tierFee: 60 }
  );
}

// Test Suite: Custom Tiers
function testCustomTiers() {
  console.log('\n=== Test: Custom Distance Tiers ===');

  const customTiers: DistanceTier[] = [
    { max_distance: 300, fee: 25 },
    { max_distance: 600, fee: 45 },
    { max_distance: 900, fee: 65 },
    { max_distance: 1200, fee: 85 }
  ];

  const logic = createTestLogic({ distanceTiers: customTiers });

  // Test: First custom tier
  const fee1 = calculateDeliveryFee(250, logic);
  logTest('Custom Tier: First Tier (250m)', fee1 === 25,
    fee1 === 25 ? undefined : `Expected 25, got ${fee1}`,
    { distance: 250, fee: fee1 }
  );

  // Test: Middle custom tier
  const fee2 = calculateDeliveryFee(750, logic);
  logTest('Custom Tier: Middle Tier (750m)', fee2 === 65,
    fee2 === 65 ? undefined : `Expected 65, got ${fee2}`,
    { distance: 750, fee: fee2 }
  );

  // Test: Last custom tier
  const fee3 = calculateDeliveryFee(1100, logic);
  logTest('Custom Tier: Last Tier (1100m)', fee3 === 85,
    fee3 === 85 ? undefined : `Expected 85, got ${fee3}`,
    { distance: 1100, fee: fee3 }
  );

  // Test: Beyond custom tiers
  const fee4 = calculateDeliveryFee(1500, logic);
  const expectedFee4 = 85 + Math.ceil((1500 - 1200) / 250) * 10; // 85 + 2 * 10 = 105
  logTest('Custom Tier: Beyond Last (1500m)', fee4 === expectedFee4,
    fee4 === expectedFee4 ? undefined : `Expected ${expectedFee4}, got ${fee4}`,
    { distance: 1500, fee: fee4, expected: expectedFee4 }
  );
}

// Test Suite: Free Delivery Logic
function testFreeDelivery() {
  console.log('\n=== Test: Free Delivery Logic ===');

  const logic = createTestLogic({
    freeDeliveryThreshold: 800,
    freeDeliveryRadius: 1000
  });

  // Test: Qualifies for free delivery (order value >= threshold AND distance <= radius)
  const free1 = checkFreeDelivery(850, 800, logic);
  logTest('Free Delivery: Qualifies (850 PKR, 800m)', free1 === true,
    free1 === true ? undefined : `Expected true, got ${free1}`,
    { orderValue: 850, distance: 800, qualifies: free1 }
  );

  // Test: Order value too low
  const free2 = checkFreeDelivery(700, 800, logic);
  logTest('Free Delivery: Order Value Too Low (700 PKR)', free2 === false,
    free2 === false ? undefined : `Expected false, got ${free2}`,
    { orderValue: 700, distance: 800, qualifies: free2 }
  );

  // Test: Distance too far
  const free3 = checkFreeDelivery(850, 1200, logic);
  logTest('Free Delivery: Distance Too Far (1200m)', free3 === false,
    free3 === false ? undefined : `Expected false, got ${free3}`,
    { orderValue: 850, distance: 1200, qualifies: free3 }
  );

  // Test: Both conditions fail
  const free4 = checkFreeDelivery(700, 1200, logic);
  logTest('Free Delivery: Both Conditions Fail', free4 === false,
    free4 === false ? undefined : `Expected false, got ${free4}`,
    { orderValue: 700, distance: 1200, qualifies: free4 }
  );

  // Test: Exactly at threshold
  const free5 = checkFreeDelivery(800, 1000, logic);
  logTest('Free Delivery: At Threshold (800 PKR, 1000m)', free5 === true,
    free5 === true ? undefined : `Expected true, got ${free5}`,
    { orderValue: 800, distance: 1000, qualifies: free5 }
  );
}

// Test Suite: Order Value Surcharge
function testOrderSurcharge() {
  console.log('\n=== Test: Order Value Surcharge ===');

  const logic = createTestLogic({
    minimumOrderValue: 200,
    smallOrderSurcharge: 40
  });

  // Test: Order value below minimum (should add surcharge)
  const surcharge1 = calculateOrderSurcharge(150, logic);
  logTest('Surcharge: Below Minimum (150 PKR)', surcharge1 === 40,
    surcharge1 === 40 ? undefined : `Expected 40, got ${surcharge1}`,
    { orderValue: 150, surcharge: surcharge1 }
  );

  // Test: Order value at minimum (no surcharge)
  const surcharge2 = calculateOrderSurcharge(200, logic);
  logTest('Surcharge: At Minimum (200 PKR)', surcharge2 === 0,
    surcharge2 === 0 ? undefined : `Expected 0, got ${surcharge2}`,
    { orderValue: 200, surcharge: surcharge2 }
  );

  // Test: Order value above minimum (no surcharge)
  const surcharge3 = calculateOrderSurcharge(250, logic);
  logTest('Surcharge: Above Minimum (250 PKR)', surcharge3 === 0,
    surcharge3 === 0 ? undefined : `Expected 0, got ${surcharge3}`,
    { orderValue: 250, surcharge: surcharge3 }
  );
}

// Test Suite: Order Value Validation
function testOrderValidation() {
  console.log('\n=== Test: Order Value Validation ===');

  const logic = createTestLogic({
    leastOrderValue: 100
  });

  // Test: Order value below least (should reject)
  const validation1 = validateOrderValue(50, logic);
  logTest('Validation: Below Least (50 PKR)', validation1.valid === false,
    validation1.valid === false ? undefined : `Expected false, got ${validation1.valid}`,
    { orderValue: 50, valid: validation1.valid, message: validation1.message }
  );

  // Test: Order value at least (should accept)
  const validation2 = validateOrderValue(100, logic);
  logTest('Validation: At Least (100 PKR)', validation2.valid === true,
    validation2.valid === true ? undefined : `Expected true, got ${validation2.valid}`,
    { orderValue: 100, valid: validation2.valid }
  );

  // Test: Order value above least (should accept)
  const validation3 = validateOrderValue(150, logic);
  logTest('Validation: Above Least (150 PKR)', validation3.valid === true,
    validation3.valid === true ? undefined : `Expected true, got ${validation3.valid}`,
    { orderValue: 150, valid: validation3.valid }
  );
}

// Test Suite: Total Delivery Fee Calculation (All Layers)
function testTotalDeliveryFee() {
  console.log('\n=== Test: Total Delivery Fee (All Layers) ===');

  const logic = createTestLogic({
    minimumOrderValue: 200,
    smallOrderSurcharge: 40,
    freeDeliveryThreshold: 800,
    freeDeliveryRadius: 1000
  });

  // Test: Free delivery applies
  const total1 = calculateTotalDeliveryFee(850, 800, logic);
  logTest('Total Fee: Free Delivery Applied', 
    total1.freeDeliveryApplied === true && total1.finalFee === 0,
    total1.freeDeliveryApplied === true && total1.finalFee === 0 
      ? undefined 
      : `Expected free delivery, got ${JSON.stringify(total1)}`,
    total1
  );

  // Test: No free delivery, no surcharge (order >= minimum)
  const total2 = calculateTotalDeliveryFee(250, 500, logic);
  const expectedBase2 = 40; // 500m falls in tier with fee 40
  logTest('Total Fee: No Free Delivery, No Surcharge', 
    total2.freeDeliveryApplied === false && 
    total2.baseFee === expectedBase2 && 
    total2.surcharge === 0 &&
    total2.finalFee === expectedBase2,
    total2.freeDeliveryApplied === false && 
    total2.baseFee === expectedBase2 && 
    total2.surcharge === 0 &&
    total2.finalFee === expectedBase2
      ? undefined 
      : `Expected baseFee=${expectedBase2}, surcharge=0, got ${JSON.stringify(total2)}`,
    total2
  );

  // Test: No free delivery, with surcharge (order < minimum)
  const total3 = calculateTotalDeliveryFee(150, 500, logic);
  const expectedBase3 = 40; // 500m falls in tier with fee 40
  const expectedSurcharge3 = 40; // 150 < 200, so surcharge applies
  logTest('Total Fee: No Free Delivery, With Surcharge', 
    total3.freeDeliveryApplied === false && 
    total3.baseFee === expectedBase3 && 
    total3.surcharge === expectedSurcharge3 &&
    total3.finalFee === expectedBase3 + expectedSurcharge3,
    total3.freeDeliveryApplied === false && 
    total3.baseFee === expectedBase3 && 
    total3.surcharge === expectedSurcharge3 &&
    total3.finalFee === expectedBase3 + expectedSurcharge3
      ? undefined 
      : `Expected baseFee=${expectedBase3}, surcharge=${expectedSurcharge3}, got ${JSON.stringify(total3)}`,
    total3
  );

  // Test: Beyond tier with max cap
  const logicWithLowMax = createTestLogic({
    maxDeliveryFee: 50,
    minimumOrderValue: 200,
    smallOrderSurcharge: 40
  });
  const total4 = calculateTotalDeliveryFee(250, 2000, logicWithLowMax);
  logTest('Total Fee: Max Cap Applied', 
    total4.baseFee <= 50 && total4.finalFee <= 50 + total4.surcharge,
    total4.baseFee <= 50 && total4.finalFee <= 50 + total4.surcharge
      ? undefined 
      : `Base fee should be capped at 50, got ${JSON.stringify(total4)}`,
    total4
  );
}

// Test Suite: Edge Cases
function testEdgeCases() {
  console.log('\n=== Test: Edge Cases ===');

  const logic = createTestLogic();

  // Test: Zero distance
  const fee1 = calculateDeliveryFee(0, logic);
  logTest('Edge Case: Zero Distance', fee1 >= 0,
    fee1 >= 0 ? undefined : `Fee should be >= 0, got ${fee1}`,
    { distance: 0, fee: fee1 }
  );

  // Test: Very small distance
  const fee2 = calculateDeliveryFee(1, logic);
  logTest('Edge Case: Very Small Distance (1m)', fee2 === 20,
    fee2 === 20 ? undefined : `Expected 20 (first tier), got ${fee2}`,
    { distance: 1, fee: fee2 }
  );

  // Test: Unordered tiers (should still work)
  const unorderedTiers: DistanceTier[] = [
    { max_distance: 600, fee: 40 },
    { max_distance: 200, fee: 20 },
    { max_distance: 1000, fee: 60 },
    { max_distance: 400, fee: 30 },
    { max_distance: 800, fee: 50 }
  ];
  const logicUnordered = createTestLogic({ distanceTiers: unorderedTiers });
  const fee3 = calculateDeliveryFee(500, logicUnordered);
  logTest('Edge Case: Unordered Tiers', fee3 === 40,
    fee3 === 40 ? undefined : `Expected 40, got ${fee3}`,
    { distance: 500, fee: fee3, note: 'Function should sort tiers' }
  );
}

// Main test runner
function runTests() {
  console.log('🚀 Starting Delivery Tiering Calculation Tests\n');

  try {
    testCalculateDistance();
    testCalculateDeliveryFee();
    testCustomTiers();
    testFreeDelivery();
    testOrderSurcharge();
    testOrderValidation();
    testTotalDeliveryFee();
    testEdgeCases();
  } catch (error: any) {
    console.error('❌ Test execution failed:', error.message);
    logTest('Test Execution', false, error.message, error);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error || 'Unknown error'}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();

