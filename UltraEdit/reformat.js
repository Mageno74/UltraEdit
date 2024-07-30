/*
auch MultiArchive möglich
die Zeilennummer bleibt erhalten
fehlenden Zeilennummern wird durch "N1 " erstzt
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
    var seq = checkIndentationSequence(codeArray)
    var ind = checkIndentation(codeArray)
    var bec = checkBrackets(codeArray)
    if (seq || ind || bec) {
        UltraEdit.messageBox("Fehler gefunden --> Nummerierung wurde abgebrochen")
        return
    }

    // Zeilen formatieren und neu nummerieren
    var renumberCNC = Array();
    renumberCNC = reformatCncCode(codeArray);

    // Löscht alle leeren Zeilen bis auf eine
    var withoutEmptyLines = Array();
    withoutEmptyLines = deleteEmptyLines(renumberCNC);

    // Verbindet die einzelnen Zeilen wieder
    codeArray = withoutEmptyLines.join('\r\n');

    // Überschreibt das Orginal
    UltraEdit.activeDocument.selectAll();
    UltraEdit.activeDocument.write(codeArray + "\r\n");
    UltraEdit.activeDocument.cancelSelect();

    UltraEdit.messageBox("formatiert")
}


//============================================================
// Formatiert den CNC Code 
//============================================================

function reformatCncCode(cncCode) {
    var tab = '  '; // Einrückung für IF oder WHILE
    var count = 0;
    renumberCNC = Array();

    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i];
        if (/^\s*%_N_/.test(line)) {
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
                var orgNumber = /^\s*N\d+/i.exec(line);
                if (!orgNumber) {
                    orgNumber = "N1";
                }
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
                line = orgNumber + line;
                renumberCNC.push(line);
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
    var maxEmptyLine = 1;  //maximale Anzahl leerer Zeilen
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
// Überprüft ob alle Schleifen geschlossen sind
//============================================================

function checkIndentation(cncCode) {
    var allFaults = {
        'IF': Array(),
        'ELSE': Array(),
        'ENDIF': Array(),
        'WHILE': Array(),
        'ENDWHILE': Array(),
        'LOOP': Array(),
        'ENDLOOP': Array(),
        'FOR': Array(),
        'ENDFOR': Array()
    }

    var lastElse = 0;

    var progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");

    if (/^\s*%_N_/.test(cncCode[0])) {
        progName = cncCode[0].replace(/^%_N_/, "");
    }

    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i];
        var lineNumber = i + 1;
        // schreibt bei einem MultiArchiv nach jendem Programm die Fehler in das Ausgabefenster
        // und alle Werte werden auf Null gesetzt
        if (/^\s*%_N_/.test(line)) {

            if (printFaults(progName, allFaults)) {
                return true
            }

            allFaults.IF.length = 0;
            allFaults.ENDIF.length = 0;
            allFaults.ENDWHILE.length = 0;
            allFaults.ELSE.length = 0;
            allFaults.WHILE.length = 0;
            allFaults.LOOP.length = 0;
            allFaults.ENDLOOP.length = 0;
            allFaults.ENDFOR.length = 0;
            allFaults.FOR.length = 0;
            allFaults.length = 0;
            lastElse = 0;
            progName = line.replace(/^\s*%_N_/, "");
        }
        // ENDIF
        if (/^\s*(N\d+)?\s*\bENDIF\b/i.test(line)) {
            if (allFaults.IF.length == 0) {
                allFaults.ENDIF.push(lineNumber);
            } else {
                var deleteElse = allFaults.IF.pop();
                var index = allFaults.ELSE.indexOf(deleteElse);
                if (index !== -1) {
                    allFaults.ELSE.splice(index, 1);
                }
            }
            continue;
        }
        // IF
        if (/^\s*(N\d+)?\s*\bIF\b/i.test(line) && !/^.*\s\bGOTO(F|B)?\b/i.test(line)) {
            allFaults.IF.push(lineNumber);
            allFaults.ELSE.push(lineNumber);
            continue;
        }
        // ELSE
        if (/^\s*(N\d+)?\s*\bELSE\b/i.test(line)) {
            if (allFaults.IF.length == 0 || lastElse == allFaults.IF[allFaults.IF.length - 1]) {
                allFaults.ELSE.push(lineNumber);
            } else {
                allFaults.ELSE.pop();
                lastElse = allFaults.IF[allFaults.IF.length - 1]
            }
            continue;
        }
        // ENDWHILE
        if (/^\s*(N\d+)?\s*\bENDWHILE\b/i.test(line)) {
            if (allFaults.WHILE.length == 0) {
                allFaults.ENDWHILE.push(lineNumber);
            } else {
                allFaults.WHILE.pop();
            }
            continue;
        }
        // WHILE
        if (/^\s*(N\d+)?\s*\bWHILE\b/i.test(line)) {
            allFaults.WHILE.push(lineNumber);
        }
        // ENDLOOP
        if (/^\s*(N\d+)?\s*\bENDLOOP\b/i.test(line)) {
            if (allFaults.LOOP.length == 0) {
                allFaults.ENDLOOP.push(lineNumber);
            } else {
                allFaults.LOOP.pop();
            }
            continue;
        }
        // LOOP
        if (/^\s*(N\d+)?\s*\bLOOP\b/i.test(line)) {
            allFaults.LOOP.push(lineNumber);
            continue;
        }
        // ENDFOR
        if (/^\s*(N\d+)?\s*\bENDFOR\b/i.test(line)) {
            if (allFaults.FOR.length == 0) {
                allFaults.ENDFOR.push(lineNumber);
            } else {
                allFaults.FOR.pop();
            }
            continue;
        }
        // FOR
        if (/^\s*(N\d+)?\s*\bFOR\b/i.test(line)) {
            allFaults.FOR.push(lineNumber);
        }
    }
    return printFaults(progName, allFaults)
}

//============================================================
// Überprüft ob Klammern paarweise vorkommen
//============================================================

function checkBrackets(cncCode) {

    var bracketFault = {
        'KlAMMER': Array()
    }
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
            if (printFaults(progName, bracketFault)) {
                return true
            }
            progName = line.replace(/^\s*%_N_/, "");
            bracketFault.KlAMMER.length = 0;
        }
        for (var n = 0; n < line.length; n++) {
            if (line[n] in bracketes) {
                stackBrackets.push(line[n])
            } else {
                for (var key in bracketes) {
                    if (bracketes[key] == line[n]) {
                        if (stackBrackets.length == 0 || key != stackBrackets.pop()) {
                            bracketFault.KlAMMER.push(lineNumber);
                            continue zeilenLoop;
                        }
                    }
                }
            }
        }
        if (stackBrackets.length != 0) {
            bracketFault.KlAMMER.push(lineNumber);
        }
    }
    return printFaults(progName, bracketFault);
}

//============================================================
// Überprüft ob Anweisungen paarweise vorkommen
//============================================================

function checkIndentationSequence(cncCode) {

    var sequenceFault = {
        'REIHENFOLGE': Array()
    }
    var stackIndetation = [];
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
            if (printFaults(progName, sequenceFault)) {
                return true
            }
            progName = line.replace(/^\s*%_N_/, "");
            sequenceFault.REIHENFOLGE.length = 0;
            var stackIndetation = [];
        }
        line = line.replace(/;.*/, "")
        if (!/^.*\bGOTO(F|B)?\b/i.test(line)) {
            var firstWord = line.match(/^\w+/i)
            if (firstWord) {
                firstWord = firstWord[0].toUpperCase()
            }
            if (firstWord in indentations) {
                stackIndetation.push(firstWord)
            } else {
                for (var key in indentations) {
                    if (indentations[key] == firstWord) {
                        if (stackIndetation.length == 0 || key != stackIndetation.pop()) {
                            sequenceFault.REIHENFOLGE.push(lineNumber);
                        }
                    }
                }
                if (firstWord == 'ELSE') {
                    if (stackIndetation.length == 0 || stackIndetation[stackIndetation.length - 1] != 'IF') {
                        sequenceFault.REIHENFOLGE.push(lineNumber);
                    }
                }
            }
        }
    }
    return printFaults(progName, sequenceFault);
}


//============================================================
// Fehlerausgabe im Ausgabefenster
//============================================================

function printFaults(progamName, allFaults) {

    // löscht alle Zeilennummern aus dem ELSE Array, die bereits als Fehler im IF Array vorhanden sind
    if ('IF' in allFaults) {
        for (var i = 0; i < allFaults.IF.length; i++) {
            var index = allFaults.ELSE.indexOf(allFaults.IF[i]);
            if (index !== -1) {
                allFaults.ELSE.splice(index, 1);
            }
        }
    }
    // Gibt Fehler aus
    var isFault = false
    for (var key in allFaults) {
        if (allFaults[key].length > 0) {
            UltraEdit.outputWindow.write("Im Programm >> " + progamName + " >> " + key + " Fehler in Zeile/n = " + allFaults[key].join(", "));
            printOneFault(allFaults[key]);
            UltraEdit.outputWindow.showWindow(true);
            isFault = true
        }
    }
    return isFault
}


//============================================================
// Fehlerausgabe mit Zeilennummer als Link
//============================================================

function printOneFault(faults) {
    var pathDoc = unescape(encodeURIComponent(UltraEdit.activeDocument.path));
    for (var i = 0; i < faults.length; i++)
        UltraEdit.outputWindow.write(pathDoc + "(" + faults[i] + "): ");
    UltraEdit.outputWindow.write("======================================================================")
}


//============================================================
//Programmaufruf
//============================================================

main()

