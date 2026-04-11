/*
auch MultiArchive möglich
die Zeilennummer bleibt erhalten
Es wird überprüft ob Klammern paarweise vorkommen
Es wird überprüft ob IF/ENDIF, WHILE/ENDWHILE und LOOP/ENDLOOP immer paarweise vorkommen.
Es wird nichts geändert und die Fehler werden im Ausgabefenster angezeigt.
*/

//============================================================
// Reguläre Ausdrücke
//============================================================
var ZEILENNUMMER = '^\\s*N\\d+';
var NEUPROG = /^\s*%_N_/;
var FLAGS = 'i';

//============================================================
// Main funktion
//============================================================
function main() {
    UltraEdit.insertMode();
    UltraEdit.columnModeOff();
    UltraEdit.activeDocument.selectAll();
    var doc = UltraEdit.activeDocument.selection;
    UltraEdit.activeDocument.cancelSelect();
    var orgArray = doc.split(/\r?\n/);

    // überprüft ob es im HEX Format ist
    if (checkIsHex(orgArray)) {
        return;
    }

    // Überprüft alle Schleifen auf Vollständigkeit
    var sequence = checkIndentationSequence(orgArray);
    // Überprüft ob Klammern paarweise vorkommen
    var brackets = checkBrackets(orgArray);
    // wenn ein Fehler gefunden wird, wird abgebrochen
    if (sequence || brackets) {
        UltraEdit.messageBox("Fehler gefunden --> Formatierung wurde abgebrochen");
        return;
    }
    UltraEdit.messageBox("checked");
}

//============================================================
// kontrolliert ob eine Datei im HEX Format ist
//============================================================
function checkIsHex(cncCode) {
    for (var i = 0; i < cncCode.length; i++) {
        if (/^\s*@/.test(cncCode[i])) {
            UltraEdit.messageBox("Datei im HEX Format kann nicht nummeriert oder formatiert werden");
            return true;
        }
    }
    return false;
}

//============================================================
// Sucht Programmanfang
//============================================================
function searchProgStart(oneLine) {
    return NEUPROG.test(oneLine);
}

//============================================================
// Entfernt Strings und Kommentare
//============================================================
function removeString(oneLine) {
    var line = oneLine.replace(/"[^"]*"/g, "");
    line = line.replace(/;.*/, "");
    return line;
}

//============================================================
// gibt den Programmname zurück
//============================================================
function getProgName(oneRow) {
    var progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");
    if (NEUPROG.test(oneRow)) {
        progName = oneRow.replace(NEUPROG, "");
    }
    return progName;
}

//============================================================
// Überprüft ob Klammern paarweise vorkommen
//============================================================
function checkBrackets(cncCode) {
    var bracketFault = [];
    var bracketes = {
        '(': ')',
        '{': '}',
        '[': ']'
    };

    var progName = getProgName(cncCode[0]);

    zeilenLoop:
    for (var i = 0; i < cncCode.length; i++) {
        var stackBrackets = [];
        var lineNumber = i + 1;
        var line = removeString(cncCode[i]);

        if (NEUPROG.test(line)) {
            if (bracketFault.length != 0) {
                break;
            }
            progName = getProgName(line);
        }
        for (var n = 0; n < line.length; n++) {
            if (line[n] in bracketes) {
                stackBrackets.push(line[n]);
                continue;
            }
            for (var key in bracketes) {
                if (bracketes[key] != line[n]) {
                    continue;
                }
                if (stackBrackets.length == 0 || key != stackBrackets.pop()) {
                    bracketFault.push(['Klammer', lineNumber, 'nicht geschlossen']);
                    continue zeilenLoop;
                }
            }
        }
        if (stackBrackets.length != 0) {
            bracketFault.push(['Klammer', lineNumber, 'nicht geschlossen']);
        }
    }
    return printFaults(progName, bracketFault);
}

//============================================================
// Überprüft ob Anweisungen paarweise vorkommen
//============================================================
function checkIndentationSequence(cncCode) {
    var faultArray = [];
    var stackIndetation = [];
    var lastIf = [];
    var stackOpenClose = {
        'IF': [],
        'WHILE': [],
        'LOOP': [],
        'FOR': [],
        'GROUP_BEGIN': []
    };
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

        if (NEUPROG.test(line)) {
            if (stackIndetation.length != 0 || faultArray.length != 0) {
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
        if (firstWord in indentations) {
            stackIndetation.push([firstWord, lineNumber]);
            stackOpenClose[firstWord].push([firstWord, lineNumber, 'nicht geschlossen']);
        } else {
            for (var key in indentations) {
                if (indentations[key] != firstWord) {
                    continue;
                }
                stackOpenClose[key].pop();
                if (stackIndetation.length == 0 || stackIndetation.pop()[0] != key) {
                    faultArray.push([firstWord, lineNumber, 'falsche Reihenfolge']);
                }
            }
        }
        if (firstWord == 'ELSE') {
            if (stackIndetation.length == 0 || stackIndetation[stackIndetation.length - 1][0] != 'IF' ||
                lastIf[lastIf.length - 1] == stackIndetation[stackIndetation.length - 1][1]
            ) {
                faultArray.push([firstWord, lineNumber, 'falsche Reihenfolge']);
            } else {
                lastIf.push(stackIndetation[stackIndetation.length - 1][1]);
            }
        }
    }
    for (var key in stackOpenClose) {
        for (var i = 0; i < stackOpenClose[key].length; i++) {
            faultArray.push(stackOpenClose[key][i]);
        }
    }
    return printFaults(progName, faultArray);
}

//============================================================
// Fehlerausgabe im Ausgabefenster
//============================================================
function printFaults(progamName, allFaults) {
    var isFault = false;
    for (var i = 0; i < allFaults.length; i++) {
        UltraEdit.outputWindow.write("Im Programm >> " + progamName + " >> " + allFaults[i][0] + " << " + allFaults[i][2] + " ==> Zeile " + allFaults[i][1]);
        printOneFault(allFaults[i]);
        UltraEdit.outputWindow.showWindow(true);
        isFault = true;
    }
    return isFault;
}

//============================================================
// Fehlerausgabe mit Zeilennummer als Link
//============================================================
function printOneFault(faults) {
    var pathDoc = unescape(encodeURIComponent(UltraEdit.activeDocument.path));
    UltraEdit.outputWindow.write(pathDoc + "(" + faults[1] + "): ");
    UltraEdit.outputWindow.write("======================================================================");
}

//============================================================
// Programmaufruf
//============================================================
main()

