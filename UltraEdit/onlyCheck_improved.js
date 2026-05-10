/*
Improved version of onlyCheck.js for UltraEdit.
This script checks CNC code (Siemens Sinumerik 840d) for:
- Paired brackets: (), {}, []
- Paired control structures: IF/ENDIF, WHILE/ENDWHILE, LOOP/ENDLOOP, FOR/ENDFOR, GROUP_BEGIN/GROUP_END
- Proper nesting and sequence of ELSE statements.
No changes are made to the file; errors are displayed in the output window.
Supports multi-archive files.
Line numbers are preserved.
*/

/**
 * Regular expressions used in the script.
 */
var LINE_NUMBER = /^\s*N\d+/;
var NEW_PROG = /^\s*%_N_/;
var FLAGS = 'i';

/**
 * Main function: Entry point for the script.
 * Performs checks on the active document and displays results.
 */
function main() {
    UltraEdit.insertMode();
    UltraEdit.columnModeOff();

    // Clear output window for fresh results
    UltraEdit.outputWindow.clear();

    UltraEdit.activeDocument.selectAll();
    var doc = UltraEdit.activeDocument.selection;
    UltraEdit.activeDocument.cancelSelect();

    if (!doc) {
        UltraEdit.messageBox("Error: No document content found.");
        return;
    }

    var orgArray = doc.split(/\r?\n/);

    // Check if the file is in HEX format
    if (checkIsHex(orgArray)) {
        return;
    }

    // Check indentation sequences (loops, ifs, etc.)
    var sequenceError = checkIndentationSequence(orgArray);
    // Check brackets
    var bracketError = checkBrackets(orgArray);

    // If errors found, abort and show message
    if (sequenceError || bracketError) {
        UltraEdit.messageBox("Errors found --> Check aborted. See output window for details.");
        return;
    }

    UltraEdit.messageBox("Check completed successfully: No errors found.");
}

/**
 * Checks if the file is in HEX format.
 * @param {Array} cncCode - Array of code lines.
 * @return {boolean} True if HEX format detected.
 */
function checkIsHex(cncCode) {
    if (!cncCode || cncCode.length === 0) {
        return false;
    }

    for (var i = 0; i < cncCode.length; i++) {
        if (/^\s*@/.test(cncCode[i])) {
            UltraEdit.messageBox("File in HEX format cannot be checked or formatted.");
            return true;
        }
    }
    return false;
}

/**
 * Searches for program start marker.
 * @param {string} oneLine - A single line of code.
 * @return {boolean} True if line is a program start.
 */
function searchProgStart(oneLine) {
    return NEW_PROG.test(oneLine);
}

/**
 * Removes strings and comments from a line for parsing.
 * @param {string} oneLine - A single line of code.
 * @return {string} Cleaned line.
 */
function removeString(oneLine) {
    var line = oneLine.replace(/"[^"]*"/g, "");
    line = line.replace(/;.*/, "");
    return line;
}

/**
 * Gets the program name from the document path or line.
 * @param {string} oneRow - A line that may contain the program name.
 * @return {string} Program name.
 */
function getProgName(oneLine) {
    var progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");
    if (NEW_PROG.test(oneLine)) {
        progName = oneLine.replace(NEW_PROG, "");
    }
    return progName;
}

/**
 * Checks if brackets are properly paired.
 * @param {Array} cncCode - Array of code lines.
 * @return {boolean} True if errors found.
 */
function checkBrackets(cncCode) {
    if (!cncCode || cncCode.length === 0) {
        return false;
    }

    var bracketFaults = [];
    var progName = getProgName(cncCode[0]);

    for (var i = 0; i < cncCode.length; i++) {
        var lineNumber = i + 1;
        var line = removeString(cncCode[i]);

        if (NEW_PROG.test(line)) {
            if (bracketFaults.length !== 0) {
                break;
            }
            progName = getProgName(line);
        }

        // Verwende Hilfsfunktionen
        var result = parseBracketsInLine(line);
        if (result.error) {
            bracketFaults.push(['Bracket', lineNumber, result.message]);
            continue;
        }
        var stackErrors = validateBracketStack(result.stack, lineNumber);
        bracketFaults = bracketFaults.concat(stackErrors);
    }
    return printFaults(progName, bracketFaults);
}

/**
 * Parst Klammern in einer Zeile und gibt Stack und Fehler zurück.
 * @param {string} line - Die zu parsende Zeile.
 * @return {Object} {stack: Array, error: boolean, message: string}
 */
function parseBracketsInLine(line) {
    var stack = [];
    var brackets = {'(': ')', '{': '}', '[': ']'};

    for (var n = 0; n < line.length; n++) {
        var char = line[n];
        if (char in brackets) {
            stack.push(char);
        } else {
            for (var key in brackets) {
                if (brackets[key] === char) {
                    if (stack.length === 0 || key !== stack.pop()) {
                        return {stack: stack, error: true, message: 'not properly closed'};
                    }
                    break;
                }
            }
        }
    }
    return {stack: stack, error: false, message: ''};
}

/**
 * Validiert den Klammer-Stack am Ende einer Zeile.
 * @param {Array} stack - Der Stack.
 * @param {number} lineNumber - Zeilennummer.
 * @return {Array} Array von Fehlern.
 */
function validateBracketStack(stack, lineNumber) {
    var faults = [];
    if (stack.length !== 0) {
        faults.push(['Bracket', lineNumber, 'not closed']);
    }
    return faults;
}

/**
 * Checks indentation sequences for control structures.
 * @param {Array} cncCode - Array of code lines.
 * @return {boolean} True if errors found.
 */
function checkIndentationSequence(cncCode) {
    if (!cncCode || cncCode.length === 0) {
        return false;
    }

    var faultArray = [];
    var stackIndentation = [];
    var lastIf = [];
    var stackOpenClose = initStackOpenClose();  // Neue Hilfsfunktion
    var indentations = {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'LOOP': 'ENDLOOP',
        'FOR': 'ENDFOR',
        'GROUP_BEGIN': 'GROUP_END'
    };

    var progName = getProgName(cncCode[0]);

    for (var i = 0; i < cncCode.length; i++) {
        var lineNumber = i + 1;
        var line = cncCode[i].replace(/^\s*(N\d+\s*)?/, "");

        if (NEW_PROG.test(line)) {
            if (stackIndentation.length !== 0 || faultArray.length !== 0) {
                break;
            }
            progName = getProgName(line);
        }

        line = line.replace(/;.*/, "");
        if (/^.*\bGOTO(F|B)?\b/i.test(line)) {
            continue;
        }

        var firstWordMatch = line.match(/^\w*/i);
        var firstWord = firstWordMatch ? firstWordMatch[0].toUpperCase() : "";

        if (isOpeningKeyword(firstWord, indentations)) {
            stackIndentation.push([firstWord, lineNumber]);
            stackOpenClose[firstWord].push([firstWord, lineNumber, 'not closed']);
        } else if (isClosingKeyword(firstWord, indentations)) {
            var opener = getOpenerForCloser(firstWord, indentations);  // Neue Hilfsfunktion
            stackOpenClose[opener].pop();
            if (stackIndentation.length === 0 || stackIndentation.pop()[0] !== opener) {
                faultArray.push([firstWord, lineNumber, 'wrong sequence']);
            }
        } else if (firstWord === 'ELSE') {
            faultArray = faultArray.concat(handleElseStatement(lineNumber, stackIndentation, lastIf));
        }
    }

    faultArray = faultArray.concat(collectUnclosedStructures(stackOpenClose));
    return printFaults(progName, faultArray);
}

/**
 * Initialisiert den Stack für offene/schließende Strukturen.
 * @return {Object} Stack-Objekt.
 */
function initStackOpenClose() {
    return {
        'IF': [],
        'WHILE': [],
        'LOOP': [],
        'FOR': [],
        'GROUP_BEGIN': []
    };
}

/**
 * Prüft, ob ein Wort eine öffnende Struktur ist.
 * @param {string} word - Das Wort.
 * @param {Object} indentations - Mapping von Öffnern zu Schließern.
 * @return {boolean}
 */
function isOpeningKeyword(word, indentations) {
    return word in indentations;
}

/**
 * Prüft, ob ein Wort eine schließende Struktur ist.
 * @param {string} word - Das Wort.
 * @param {Object} indentations - Mapping.
 * @return {boolean}
 */
function isClosingKeyword(word, indentations) {
    for (var key in indentations) {
        if (indentations[key] === word) {
            return true;
        }
    }
    return false;
}

/**
 * Holt den Öffner für einen Schließer.
 * @param {string} closer - Der Schließer.
 * @param {Object} indentations - Mapping.
 * @return {string} Der Öffner.
 */
function getOpenerForCloser(closer, indentations) {
    for (var key in indentations) {
        if (indentations[key] === closer) {
            return key;
        }
    }
    return '';
}

/**
 * Behandelt ELSE-Statements.
 * @param {number} lineNumber - Zeilennummer.
 * @param {Array} stackIndentation - Stack.
 * @param {Array} lastIf - Letzte IFs.
 * @return {Array} Fehler-Array.
 */
function handleElseStatement(lineNumber, stackIndentation, lastIf) {
    var faults = [];
    if (stackIndentation.length === 0 || stackIndentation[stackIndentation.length - 1][0] !== 'IF' ||
        lastIf[lastIf.length - 1] === stackIndentation[stackIndentation.length - 1][1]) {
        faults.push(['ELSE', lineNumber, 'wrong sequence']);
    } else {
        lastIf.push(stackIndentation[stackIndentation.length - 1][1]);
    }
    return faults;
}

/**
 * Sammelt offene Strukturen als Fehler.
 * @param {Object} stackOpenClose - Stack.
 * @return {Array} Fehler-Array.
 */
function collectUnclosedStructures(stackOpenClose) {
    var faults = [];
    for (var key in stackOpenClose) {
        for (var j = 0; j < stackOpenClose[key].length; j++) {
            faults.push(stackOpenClose[key][j]);
        }
    }
    return faults;
}

/**
 * Prints faults to the output window.
 * @param {string} progName - Program name.
 * @param {Array} allFaults - Array of faults.
 * @return {boolean} True if faults were found.
 */
function printFaults(progName, allFaults) {
    var hasFault = false;
    for (var i = 0; i < allFaults.length; i++) {
        UltraEdit.outputWindow.write("In program >> " + progName + " >> " + allFaults[i][0] + " << " + allFaults[i][2] + " ==> Line " + allFaults[i][1]);
        printOneFault(allFaults[i]);
        UltraEdit.outputWindow.showWindow(true);
        hasFault = true;
    }
    return hasFault;
}

/**
 * Prints a single fault with line link.
 * @param {Array} fault - Fault details [type, line, message].
 */
function printOneFault(fault) {
    var pathDoc = unescape(encodeURIComponent(UltraEdit.activeDocument.path));
    UltraEdit.outputWindow.write(pathDoc + "(" + fault[1] + "): ");
    UltraEdit.outputWindow.write("======================================================================");
}

// Program call
main();