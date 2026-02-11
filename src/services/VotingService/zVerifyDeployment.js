/**
 * Deployment verification script for VotingService constants
 * This file can be used to verify that constants are properly loaded
 * when deployed via clasp push to Google Apps Script
 */

function verifyVotingServiceConstants() {
  try {
    // Test that VotingService.Constants is available
    if (typeof VotingService === 'undefined') {
      throw new Error('VotingService is not defined');
    }
    
    if (typeof VotingService.Constants === 'undefined') {
      throw new Error('VotingService.Constants is not defined');
    }
    
    // Test that namespace properties from 1namespaces.js are also present
    if (typeof VotingService.name === 'undefined') {
      throw new Error('VotingService.name is not defined (namespace integration failed)');
    }
    
    if (VotingService.name !== 'Voting Service') {
      throw new Error('VotingService.name has wrong value (namespace integration failed)');
    }
    
    // Test some key constants
    const requiredConstants = [
      'FORM_EDIT_URL_COLUMN_NAME',
      'TOKEN_ENTRY_FIELD_TITLE',
      'RESULTS_SUFFIX',
      'ElectionState'
    ];
    
    for (const constant of requiredConstants) {
      if (typeof VotingService.Constants[constant] === 'undefined') {
        throw new Error(`VotingService.Constants.${constant} is not defined`);
      }
    }
    
    // Test ElectionState enum
    if (VotingService.Constants.ElectionState.ACTIVE !== 'ACTIVE') {
      throw new Error('ElectionState enum not properly defined');
    }
    
    console.log('✅ All VotingService constants verified successfully');
    console.log('✅ Namespace integration working (Constants + Service properties)');
    console.log('📋 Available constants:', Object.keys(VotingService.Constants));
    console.log('📋 Service properties:', ['name', 'service', 'Data', 'Trigger', 'Constants'].filter(prop => VotingService[prop] !== undefined));
    
    return true;
  } catch (error) {
    console.error('❌ VotingService constants verification failed:', error.message);
    return false;
  }
}

/**
 * Test that constants work in actual function calls
 */
function testConstantsInFunctions() {
  try {
    // Test a simple function that uses constants
    const testElection = {};
    testElection[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME] = 'test-form-id';
    
    console.log('✅ Constants work in function calls');
    console.log('📝 Test election object:', testElection);
    
    return true;
  } catch (error) {
    console.error('❌ Constants function test failed:', error.message);
    return false;
  }
}

// Auto-run verification when this file is loaded
function runAllVerifications() {
  console.log('🔍 Starting VotingService constants verification...');
  
  const constantsOk = verifyVotingServiceConstants();
  const functionsOk = testConstantsInFunctions();
  
  if (constantsOk && functionsOk) {
    console.log('🎉 All verifications passed! VotingService is ready for use.');
  } else {
    console.log('⚠️  Some verifications failed. Check the logs above.');
  }
  
  return constantsOk && functionsOk;
}