// Include the sortArraysByValue function here or ensure it is accessible
function sortArraysByValue(arr1, arr2, compareFn) {
    if (arr1.length !== arr2.length) {
        throw new Error("Both arrays must have the same length");
    }
    const combined = arr1.map((value, index) => ({ value, index }));
    combined.sort((a, b) => compareFn(a.value !== undefined ? a.value : a, b.value !== undefined ? b.value : b));
    const sortedArr1 = combined.map(item => item.value);
    const sortedArr2 = combined.map(item => arr2[item.index]);
    arr1.splice(0, arr1.length, ...sortedArr1);
    arr2.splice(0, arr2.length, ...sortedArr2);
}

// Simple test framework
function assertEqual(actual, expected, message) {
    const isEqual = (a, b) => {
        if (Array.isArray(a) && Array.isArray(b)) {
            return a.length === b.length && a.every((val, index) => isEqual(val, b[index]));
        } else if (typeof a === 'object' && typeof b === 'object') {
            return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => isEqual(a[key], b[key]));
        }
        return a === b;
    };

    if (!isEqual(actual, expected)) {
        console.error(`Assertion failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    } else {
        console.log(`Assertion passed: ${message}`);
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        console.error(`Assertion failed: ${message}\nExpected an error to be thrown`);
    } catch (e) {
        console.log(`Assertion passed: ${message}`);
    }
}

// Test cases
function testSortArraysByValue() {
    console.log('Running tests for sortArraysByValue...');

    // Test 1
    let arr1 = [3, 1, 2];
    let arr2 = ['three', 'one', 'two'];
    sortArraysByValue(arr1, arr2, (a, b) => a - b);
    assertEqual(arr1, [1, 2, 3], 'should sort arr1 by value');
    assertEqual(arr2, ['one', 'two', 'three'], 'should sort arr2 to match sorted arr1');

    // Test 2
    arr1 = [3, 1];
    arr2 = ['three', 'one', 'two'];
    assertThrows(() => sortArraysByValue(arr1, arr2, (a, b) => a - b), 'should throw error if arrays have different lengths');

    // Test 3
    arr1 = [{ value: 3 }, { value: 1 }, { value: 2 }];
    arr2 = [{ name: 'three' }, { name: 'one' }, { name: 'two' }];
    sortArraysByValue(arr1, arr2, (a, b) => a.value - b.value);
    assertEqual(arr1, [{ value: 1 }, { value: 2 }, { value: 3 }], 'should sort arr1 with complex objects');
    assertEqual(arr2, [{ name: 'one' }, { name: 'two' }, { name: 'three' }], 'should sort arr2 with complex objects to match sorted arr1');
}

// Run the tests
// testSortArraysByValue();