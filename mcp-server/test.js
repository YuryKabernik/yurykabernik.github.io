#!/usr/bin/env node

/**
 * Simple test script to verify MCP server functionality
 * This is a basic sanity check, not a comprehensive test suite
 */

import { loadRules } from './src/rules-loader.js';
import { loadPrompts } from './src/prompts-loader.js';
import { loadInstructions } from './src/instructions-loader.js';

async function runTests() {
  console.log('Running MCP Server Tests...\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Load Rules
  console.log('Test 1: Loading rules...');
  try {
    const rules = await loadRules();
    if (rules.length > 0) {
      console.log(`✓ Loaded ${rules.length} rules`);
      passed++;
    } else {
      console.log('✗ No rules loaded');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error loading rules:', error.message);
    failed++;
  }

  // Test 2: Load Prompts
  console.log('\nTest 2: Loading prompts...');
  try {
    const prompts = await loadPrompts();
    if (prompts.length > 0) {
      console.log(`✓ Loaded ${prompts.length} prompts`);
      passed++;
    } else {
      console.log('✗ No prompts loaded');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error loading prompts:', error.message);
    failed++;
  }

  // Test 3: Load Instructions
  console.log('\nTest 3: Loading instructions...');
  try {
    const instructions = await loadInstructions();
    if (instructions.length > 0) {
      console.log(`✓ Loaded ${instructions.length} instructions`);
      passed++;
    } else {
      console.log('✗ No instructions loaded');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error loading instructions:', error.message);
    failed++;
  }

  // Test 4: Validate Rules Structure
  console.log('\nTest 4: Validating rules structure...');
  try {
    const rules = await loadRules();
    const hasRequiredFields = rules.every(rule => 
      rule.id && rule.type && rule.category && rule.title && 
      rule.description && rule.priority && rule.details
    );
    if (hasRequiredFields) {
      console.log('✓ All rules have required fields (id, type, category, title, description, priority, details)');
      passed++;
    } else {
      console.log('✗ Some rules missing required fields');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error validating rules:', error.message);
    failed++;
  }

  // Test 5: Check Rule Categories
  console.log('\nTest 5: Checking rule categories...');
  try {
    const rules = await loadRules();
    const microserviceRules = rules.filter(r => r.type === 'microservice');
    const microfrontendRules = rules.filter(r => r.type === 'microfrontend');
    
    if (microserviceRules.length > 0 && microfrontendRules.length > 0) {
      console.log(`✓ Found ${microserviceRules.length} microservice rules and ${microfrontendRules.length} microfrontend rules`);
      passed++;
    } else {
      console.log('✗ Missing microservice or microfrontend rules');
      failed++;
    }
  } catch (error) {
    console.log('✗ Error checking categories:', error.message);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✓ All tests passed! MCP Server is ready to use.');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

runTests();
