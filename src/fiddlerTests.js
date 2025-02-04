function testFiddler() {
    // testFiddlerSort_();
    testFiddlerSortAndCombine_();
}

function testFiddlerSortAndCombine_() {
    let fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: true }).needFormulas();
    const data = [{ value: "=3 + 4", expected: 7 }, { value: "5", expected: 5 }, { value: "=1 + 2", expected: 3 }];
    saveSortedFiddlerWithFormulas_(fiddler, data, (a, b) => a.value - b.value);
    fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: false }).needFormulas();
    const data2 = fiddler.getData();
    log("data2", data2);
    const formulas = fiddler.getFormulaData();
    log("formulas", formulas);
    const data3 = [{ value: "=1+0", expected: 1 }, { value: "=2+0", expected: 2 }, { value: "=3 +0", expected: 3 }];
    log("data3", data3);
     fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: true }).needFormulas();
     const fd = combineArrays(fiddler.getFormulaData(), fiddler.getData());
     log('fd:', fd);
     const d = [...fd, ...data3];    
     log('d:', d);
    saveSortedFiddlerWithFormulas_(fiddler, d, (a, b) => {
        const result = a.expected - b.expected;
        log(`Comparing a: ${JSON.stringify(a)}, b: ${JSON.stringify(b)}, result: ${result}`);
        return result;
    });
    fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: false }).needFormulas();
    log('final d:', fiddler.getData());
    log('final formulas:', fiddler.getFormulaData());

}

function saveSortedFiddlerWithFormulas_(fiddler, data, sortFunction) {
    const formulas = fiddler.getFormulaData();
    let combined ;
    if (formulas.length === data.length) {
         combined = sortAndCombine_(formulas, data, sortFunction);
    } else {
        combined = data;
    }
    fiddler.setData(combined).dumpValues();
}

function testFiddlerSort_() {
    let fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: true }).needFormulas();
    const data = [{ value: "=3 + 4", expected: 7 }, { value: "5", expected: 5 }, { value: "=1 + 2", expected: 3 }];
    log("data", data);
    fiddler.setData(data);
    saveFiddlerWithFormulas_(fiddler);
    fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: false }).needFormulas();
    const keepFormulas = fiddler.getColumnsWithFormulas();
    console.log("keepFormulas", keepFormulas);
    const data2 = fiddler.getData();
    log("data2", data2);
    assertEqual_(data2.map(d => [d.value]), data.map(d => [d.expected]));
    const formulas = fiddler.getFormulaData();
    log("formulas", formulas);
    data2.sort((a, b) => a.value - b.value);
    log("data2 - SORTED", data2);
    fiddler.setData(data2);
    saveFiddlerWithFormulas_(fiddler);
    const formulas2 = fiddler.getFormulaData();
    log("formulas2", formulas2);
    fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: false }).needFormulas();
    const data3 = fiddler.getData();
    log("data3", data3);
    sortArraysByValue_(data3, formulas2)
    log("data3", data3);
    log("formulas2", formulas2);
    let f3 = combineArrays_(formulas2, data3);
    log(f3);
    fiddler.setData(f3);
    saveFiddlerWithFormulas_(fiddler);
    fiddler = bmPreFiddler.PreFiddler().getFiddler({ sheetName: "Test", createIfMissing: false }).needFormulas();
    const data4 = fiddler.getData();
    log("data4", data4);
    const formulas4 = fiddler.getFormulaData();
    log("formulas4", formulas4);
}
function assertEqual_(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Assertion failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
    }
}

function saveFiddlerWithFormulas_(fiddler) {
    const formulas = fiddler.getColumnsWithFormulas();
    fiddler.mapRows((row, { rowFormulas }) => {

        formulas.forEach(f => {
            // log(`row[${f}]: `, row[f]);
            // log(`rowFormulas[${f}]:`, rowFormulas[f])
            if (rowFormulas && rowFormulas[f] !== undefined) {
                row[f] = rowFormulas[f];
            }
        });
        return row;
    });
    fiddler.dumpValues();
}

function sortArraysByValue_(arr1, arr2, sortFunction) {
    if (arr1.length !== arr2.length) {
        throw new Error("Both arrays must have the same length");
    }

    const combined = arr1.map((item, index) => ({ item, obj: arr2[index] }));
    combined.sort(sortFunction);

    for (let i = 0; i < combined.length; i++) {
        arr1[i] = combined[i].item;
        arr2[i] = combined[i].obj;
    }
}


function sortAndCombine_(arr1, arr2, sortFunction) {
    sortArraysByValue_(arr1, arr2, sortFunction);
    return combineArrays_(arr1, arr2);
}