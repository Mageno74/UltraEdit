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
// Variablen 
//============================================================
var EINRUECKUNG = 2; // Einrückung für IF oder WHILE -> bei Bedarf ändern
var LEEREZEILEN = 1; // Anzahl der leeren Zeilen -> bei Bedarf ändern

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
    UltraEdit.columnModeOff();
    UltraEdit.activeDocument.selectAll();
    var cncCode = UltraEdit.activeDocument.selection;
    UltraEdit.activeDocument.cancelSelect();
    var orgArray = cncCode.split(/\r?\n/);

    // überprüft ob es im HEX Format ist
    if (checkIsHex(orgArray)) {
        UltraEdit.messageBox("Datei im HEX Format kann nicht nummeriert oder formatiert werden");
        return;
    }

    // Überprüft alle Schleifen auf Vollständigkeit
    var seq = checkIndentationSequence(orgArray);
    // Überprüft ob Klammern paarweise vorkommen
    var bec = checkBrackets(orgArray);
    // wenn ein Fehler gefunden wird, wird abgebrochen
    if (seq || bec) {
        UltraEdit.messageBox("Fehler gefunden --> Nummerierung wurde abgebrochen");
        return;
    }

    // Zeilen formatieren und neu nummerieren
    var reNumbArray = reformatCncCode(orgArray);

    // Löscht alle leeren Zeilen bis auf eine
    var noEptLinArray = deleteEmptyLines(reNumbArray);

    // Verbindet die einzelnen Zeilen wieder
    var newArray = noEptLinArray.join('\r\n');

    // Überschreibt das Original
    UltraEdit.activeDocument.selectAll();
    UltraEdit.activeDocument.write(newArray + '\r\n');
    UltraEdit.activeDocument.cancelSelect();

    UltraEdit.messageBox("formatiert");
}

//============================================================
// kontrolliert ob eine Datei im HEX Format ist
//============================================================
function checkIsHex(cncCode) {
    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i];
        if (/^\s*@/.test(line)) {
            return true;
        }
    }
    return false;
}

//============================================================
// Standardeinrückung festlegen
//============================================================
function indentations() {
    var tabSize = '';
    for (var i = 0; i < EINRUECKUNG; i++) {
        tabSize += ' ';
    }
    return tabSize;
}

//============================================================
// sucht nach Zeilen die nicht verändert werden sollen
//============================================================
function unchangeLine(oneLine) {
    if (NEUPROG.test(oneLine) || /^\s*;/.test(oneLine) || /^$/.test(oneLine)) {
        oneLine = oneLine.trim();
        return oneLine;
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
// Formatiert den CNC Code 
//============================================================
function reformatCncCode(cncCode) {
    var tab = indentations();
    var count = 0;
    var regLineNum = new RegExp(ZEILENNUMMER, FLAGS);
    var regLineNumCom = new RegExp(ZEILENNUMMER + ';', FLAGS);
    var regOnlyLineNum = new RegExp(ZEILENNUMMER + '(\\s|$)', FLAGS);

    var renumbProg = [];

    zeilenLoop:
    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i];
        if (searchProgStart(line)) {
            count = 0;
        }
        var result;
        if ((result = unchangeLine(line)) !== false) {
            renumbProg.push(result);
            continue zeilenLoop;
        }
        if (regLineNumCom.test(line)) {
            line = line.replace(regLineNum, '');
        } else {
            var orgNumber = /^\s*N\d+/i.exec(line);
            if (!orgNumber) {
                orgNumber = "N1";
            }
            line = line.replace(regOnlyLineNum, '').trim();
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
            renumbProg.push(line);
        }
    }
    return renumbProg;
}

//============================================================
// Löscht alle leeren Zeilen bis auf eine
//============================================================
function deleteEmptyLines(cncCode) {
    var result = [];
    var countEmptyLine = 0;
    for (var i = 0; i < cncCode.length; i++) {
        if (cncCode[i].trim() == '') {
            countEmptyLine++;
        } else {
            countEmptyLine = 0;
        }
        if (countEmptyLine <= LEEREZEILEN) {
            result.push(cncCode[i]);
        }
    }
    return result;
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
    var stackIndetation = [];
    var lastIf = [];
    var stackOpenClose = {
        'IF': [],
        'WHILE': [],
        'LOOP': [],
        'FOR': []
    };
    var indentations = {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'LOOP': 'ENDLOOP',
        'FOR': 'ENDFOR'
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
        if (!/^.*\bGOTO(F|B)?\b/i.test(line)) {
            var firstWordMatch = line.match(/^\w*/i);
            var firstWord = firstWordMatch ? firstWordMatch[0].toUpperCase() : "";
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
// Programmaufruf
//============================================================
main()

