/*
auch MultiArchive möglich
es werden alle Zeilen nummeriert die nicht leer sind, nicht mit einem
";" oder mit "%" beginnen.
bei Zeilen in denen nur eine Zeilennummer ist, aber sonst leer ist. Wird die
Zeilennummer gelöscht.
Leerzeichen am Zeilenende werden entfernt.
Nach der Zeilennummer werden alle Leerzeichen bis auf eins entfernt.
Mehr als eine Leerzeile wird entfernt
Einrückung reformatieren bei IF, While und LOOP.
Es wird überprüft ob IF/ENDIF, WHILE/ENDWHILE und LOOP/ENDLOOP immer paarweise vorkommen.
*/

//============================================================
// Main funktion
//============================================================

function main() {
    UltraEdit.columnModeOff();
    UltraEdit.activeDocument.selectAll();
    var cncCode = UltraEdit.activeDocument.selection;
    UltraEdit.activeDocument.cancelSelect();
    var codeArray = Array(); codeArray = cncCode.split(/\r?\n/);

    // Überprüft ob Klammern paarweise vorkommen
    // Überprüft alle Schleifen auf Vollständigkeit
    var seq = checkIndentationSequence(codeArray);
    var bec = checkBrackets(codeArray);
    if (seq || bec) {
        UltraEdit.messageBox("Fehler gefunden --> Nummerierung wurde abgebrochen");
        return;
    }

    // Zeilen formatieren und neu nummerieren
    var renumberCNC = Array();
    renumberCNC = renumberCncCode(codeArray);

    // Löscht alle leeren Zeilen bis auf eine
    var withoutEmptyLines = Array();
    withoutEmptyLines = deleteEmptyLines(renumberCNC);

    // Verbindet die einzelnen Zeilen wieder
    codeArray = withoutEmptyLines.join('\r\n');

    // Überschreibt das Orginal
    UltraEdit.activeDocument.selectAll();
    UltraEdit.activeDocument.write(codeArray + "\r\n");
    UltraEdit.activeDocument.cancelSelect();

    UltraEdit.messageBox("nummeriert und formatiert");
}


//============================================================
// Formatiert den CNC Code 
//============================================================

function renumberCncCode(cncCode) {
    var tab = '  '; // Einrückung für IF oder WHILE -> bei Bedarf ändern
    var count = 0;
    renumberCNC = Array();

    var startNumber = UltraEdit.getValue("Startnummer (Standart=1000) = ", 1);
    var increment = UltraEdit.getValue("Increment (Standart=5) = ", 1);

    if (!/^\d+$/.test(startNumber) || (startNumber > 999999 || startNumber < 1)) {
        startNumber = 1000;
    }

    if (!/^\d+$/.test(increment) || (increment > 9999 || increment < 1)) {
        increment = 5;
    }

    var lineNumber = startNumber;
    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i];
        if (/^\s*%_N_/.test(line)) {
            lineNumber = startNumber;
            count = 0;
        }

        if (/^\s*%_N_/.test(line) || /^\s*;/.test(line) || /^$/.test(line)) {
            line = line.replace(/^\s+/, '');
            line = line.replace(/\s+$/, '');
            renumberCNC.push(line);
        } else {
            if (/^\s*N\d+;/i.test(line)) {
                line = line.replace(/^\s*N\d+/i, '');
            } else {
                line = line.replace(/^\s*N\d+(\s|$)/i, '');
                line = line.replace(/^\s+/, '');
                line = line.replace(/\s+$/, '');
                if (/^\s*\b(ENDIF|ELSE|ENDWHILE|ENDLOOP|ENDFOR)\b/i.test(line) && count > 0) {
                    count--;
                }
                var space = ' ';
                for (var n = 0; n < count; n++) {
                    space += tab;
                }
                if (!/^$/.test(line)) {
                    line = space + line;
                }
                if ((/^\s*\b(IF|ELSE|WHILE|LOOP|FOR)\b/i.test(line) && !/^.*\bGOTO(F|B)?\b/i.test(line))) {
                    count++;
                }
            }
            if (!/^$/.test(line)) {
                line = 'N' + lineNumber + line;
                renumberCNC.push(line);
                lineNumber += increment;
            }
        }
    }
    return renumberCNC;
}


//============================================================
// Löscht alle leeren Zeilen bis auf eine
//============================================================

function deleteEmptyLines(cncCode) {
    var countEmptyLine = 0;
    var maxEmptyLine = 1;  //maximale Anzahl leerer Zeilen -> bei Bedarf ändern
    // Löscht alle leeren Zeilen bis auf eine
    for (var i = 0; i < cncCode.length; i++) {
        if (cncCode[i] == '') {
            countEmptyLine++;
        } else {
            countEmptyLine = 0;
        }
        if (countEmptyLine > maxEmptyLine) {
            cncCode.splice(i, 1);
            i--;
        }
    }
    return cncCode;
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
    var progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");

    if (/^\s*%_N_/.test(cncCode[0])) {
        progName = cncCode[0].replace(/^\s*%_N_/, "");
    }

    zeilenLoop:
    for (var i = 0; i < cncCode.length; i++) {
        var stackBrackets = [];
        lineNumber = i + 1;
        var line = cncCode[i].replace(/;.*/, "");

        if (/^\s*%_N_/.test(line)) {
            if (bracketFault.length != 0) {
                break;
            }
            progName = line.replace(/^\s*%_N_/, "");
            bracketFault.length = 0;
        }
        for (var n = 0; n < line.length; n++) {
            if (line[n] in bracketes) {
                stackBrackets.push(line[n]);
            } else {
                for (var key in bracketes) {
                    if (bracketes[key] == line[n]) {
                        if (stackBrackets.length == 0 || key != stackBrackets.pop()) {
                            bracketFault.push(['Klammer', lineNumber, 'nicht geschlossen']);
                            continue zeilenLoop;
                        }
                    }
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
    var faultArray = [];
    var stackIndetation = [];
    var lastIf = [];
    var stackOpenClose = {
        'IF': Array(),
        'WHILE': Array(),
        'LOOP': Array(),
        'FOR': Array()
    };
    var indentations = {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'LOOP': 'ENDLOOP',
        'FOR': 'ENDFOR'
    };
    var progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");

    if (/^\s*%_N_/.test(cncCode[0])) {
        progName = cncCode[0].replace(/^\s*%_N_/, "");
    }
    for (var i = 0; i < cncCode.length; i++) {
        lineNumber = i + 1;
        var line = cncCode[i].replace(/^\s*(N\d+\s*)?/, "");

        if (/^\s*%_N_/.test(line)) {
            if (stackIndetation.length != 0 || faultArray.length != 0) {
                break;
            }
            progName = line.replace(/^\s*%_N_/, "");
            faultArray.length = 0;
            var stackIndetation = [];
        }
        line = line.replace(/;.*/, "");
        if (!/^.*\bGOTO(F|B)?\b/i.test(line)) {
            var firstWord = line.match(/^\w*/i)[0].toUpperCase();
            if (firstWord in indentations) {
                stackIndetation.push([firstWord, lineNumber]);
                stackOpenClose[firstWord].push([firstWord, lineNumber, 'nicht geschlossen']);
            } else {
                for (var key in indentations) {
                    if (indentations[key] == firstWord) {
                        stackOpenClose[key].pop();
                        if (stackIndetation.length == 0 || stackIndetation.pop()[0] != key) {
                            faultArray.push([firstWord, lineNumber, 'falsche Reihenfolge']);
                        }
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
//Programmaufruf
//============================================================

main()

