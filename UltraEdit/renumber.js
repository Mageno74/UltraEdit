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
// Variablen 
//============================================================
var EINRUECKUNG = 2; // Einrückung für IF oder WHILE -> bei Bedarf ändern
var LEEREZEILEN = 1; // maximale Anzahl der leeren Zeilen -> bei Bedarf ändern
var STATNUMMER = 1000; // Startnummer -> bei Bedarf ändern
var INCREMENT = 5; // Inkrement -> bei Bedarf ändern
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

    // Zeilen formatieren und neu nummerieren
    var reNumbArray = renumberCncCode(orgArray);

    // Löscht alle leeren Zeilen bis auf eine
    var noEptLinArray = deleteEmptyLines(reNumbArray);

    // Verbindet die einzelnen Zeilen wieder
    var newArray = noEptLinArray.join('\r\n');

    // Überschreibt das Original
    UltraEdit.activeDocument.selectAll();
    UltraEdit.activeDocument.write(newArray + '\r\n');
    UltraEdit.activeDocument.cancelSelect();

    UltraEdit.messageBox("nummeriert und formatiert");
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
// Eingabe von Startnummer und Schritt
//============================================================
function getStartNumber() {
    var startNumber = parseInt(UltraEdit.getValue("Startnummer (Standard=" + STATNUMMER + ")", 1), 10);
    var increment = parseInt(UltraEdit.getValue("Increment (Standard=" + INCREMENT + ")", 1), 10);

    if (isNaN(startNumber) || startNumber > 999999 || startNumber < 1) {
        startNumber = STATNUMMER;
    }
    if (isNaN(increment) || increment > 9999 || increment < 1) {
        increment = INCREMENT;
    }
    return [startNumber, increment];
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
    if (regex.noNcCode.test(oneLine)) {
        oneLine = oneLine.trim();
        return oneLine;
    }
    return false;
}

//============================================================
// Sucht Programmanfang
//============================================================
function searchProgStart(oneLine) {
    return regex.newProgram.test(oneLine);
}

function lineDitc(line) {
    return {
            lineNum: '',
            code: '',
            comment: '',
            deleteSting: '',
            emptyLines: 0
    };
}

function parseLine(line, lineData) {
    if (line) {
        lineData.lineNum = /(^N\d+)/i.exec(line)?.[1] ?? '';
        lineData.code = line.replace(/(^N\d+)/i, '')
            .replace(/\s*;.*/i, '');
        lineData.comment = /(\s*;.*)/.exec(line)?.[1] ?? '';
    }
    return lineData;
}


//============================================================
// Formatiert den CNC Code 
//============================================================
function renumberCncCode(cncCode) {
    var tab = indentations();
    var count = 0;
    //var regex = new RegexDictionary();
    var renumbProg = [];

    var startNumStep = getStartNumber();
    var startNum = startNumStep[0];
    var step = startNumStep[1];
    var lineNumber = startNum;
    var lineData = lineDitc();

    for (var i = 0; i < cncCode.length; i++) {
        var line = cncCode[i].trim();
        parseLine(line, lineData);
        if (searchProgStart(lineData.co)) {
            lineNumber = startNum;
            count = 0;
        }
        var result = unchangeLine(line);
        if ((result) !== false) {
            renumbProg.push(result);
            continue;
        }
        line = line.replace(regex.lineNumer, '');
        if (lineData.lineNum && (lineData.code || lineData.comment)) {
            line = line.trim();
            if (regex.closeInstruction.test(line) && count > 0) {
                count--;
            }
            var space = ' ';
            for (var n = 0; n < count; n++) {
                space += tab;
            }
            if (!regex.noNcCode.test(line)) {
                line = space + line;
            }
            if ((regex.openInstruction.test(line.trim()) && !regex.gotoInstruction.test(line.trim()))) {
                count++;
            }
        }
        if (line.trim()) {
            line = 'N' + lineNumber + line;
            renumbProg.push(line);
            lineNumber += step;
        }
        renumbProg.push(line);
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
    if (regex.newProgram.test(oneRow)) {
        progName = oneRow.replace(regex.newProgram, "");
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

        if (regex.newProgram.test(line)) {
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

function initializeStack() {
    return {
        sequence: [],
        errorMessage: [],
        group: [],
        sequenceGroup: [],
        lastIf: [],
        openClose: {
            IF: [],
            WHILE: [],
            LOOP: [],
            FOR: [],
            GROUP_BEGIN: [],
            REPEAT: [],
        },
    };
}

class RegexDictionary {
    lineNumer = /^\s*N\d+/i;
    comment = /;.*/;
    noNcCode = /^\s*(;|%|$)/;
    newProgram = /^%/;
    string = /"[^"]*"/g;
    instruction = /^(\w*)\s*\(?\s*(\d+)?(.*)/i;
    closeInstruction = /^\b(ENDIF|ENDWHILE|ELSE|ENDLOOP|ENDFOR|UNTIL)\b/i;
    openInstruction = /^\b(IF|WHILE|ELSE|LOOP|FOR|REPEAT$)\b/i;
    gotoInstruction = /^.*\b(GOTO(F|B)?)\b/i;
}
var regex = new RegexDictionary();


function handleElse(firstWord, lineNumber, stack) {
    if (stack.sequence.length == 0 || stack.sequence[stack.sequence.length - 1][0] != 'IF' ||
        stack.lastIf[stack.lastIf.length - 1] == stack.sequence[stack.sequence.length - 1][1]
    ) {
        stack.errorMessage.push([firstWord, lineNumber, 'falsche Reihenfolge']);
    } else {
        stack.lastIf.push(stack.sequence[stack.sequence.length - 1][1]);
    }
}

// Funktion zur Behandlung von GROUP_BEGIN
function handleGroupBegin(firstWord, groupID, groupName, lineNumber, stack) {
    if (stack.sequenceGroup.includes(groupID)) {
        stack.errorMessage.push([firstWord, lineNumber, `GROUP_BEGIN(${groupID}${groupName}) hat bereits eine offene Gruppe`]);
    }
    stack.group.push([`GROUP_BEGIN(${groupID}${groupName})`, lineNumber, 'nicht geschlossen']);
    stack.sequenceGroup.push(groupID);
}

// Funktion zur Behandlung von GROUP_END
function handleGroupEnd(firstWord, groupID, groupName, lineNumber, stack) {
    if (stack.sequenceGroup.length === 0 || groupID !== stack.sequenceGroup[stack.sequenceGroup.length - 1]) {
        stack.errorMessage.push([firstWord, lineNumber, `GROUP_END(${groupID}${groupName}) in falscher Reihenfolge`]);
    }
    stack.sequenceGroup.pop();
    stack.group.pop();
}

//============================================================
// Überprüft ob Anweisungen paarweise vorkommen
//============================================================
function checkIndentationSequence(cncCode) {
    var stack = initializeStack();
    //var regex = new RegexDictionary();
    var instruction = {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'LOOP': 'ENDLOOP',
        'FOR': 'ENDFOR',
        'GROUP_BEGIN': 'GROUP_END',
        'REPEAT': 'UNTIL'
    };

    var progName = getProgName(cncCode[0]);

    for (var i = 0; i < cncCode.length; i++) {
        var lineNumber = i + 1;
        var line = cncCode[i].replace(/^\s*(N\d+\s*)?/, "");

        if (regex.newProgram.test(line)) {
            if (stack.sequence.length != 0 || stack.errorMessage.length != 0) {
                break;
            }
            progName = getProgName(line);
        }
        var cleanedLine = line.replace(regex.comment, "");

        // Regex-Matching
        var match = cleanedLine.match(regex.instruction);

        // Frühzeitiges Beenden bei GOTO-Instruktionen
        if (regex.gotoInstruction.test(cleanedLine)) {
            continue;
        }

        // Frühzeitiges Beenden bei REPEAT mit zusätzlichem Inhalt
        if (match && match[1].toUpperCase() === 'REPEAT' && match[3] !== '') {
            continue;
        }
        // Überprüfung auf gültige Instruktionen
        var firstWord = "";
        if (match) {
            firstWord = match[1].toUpperCase();
            var groupID = match[2] || '';
            var groupName = match[3] || '';

        }
        if (!instruction[firstWord] && !Object.values(instruction).includes(firstWord) && firstWord !== 'ELSE') {
            continue
        }

        if (firstWord in instruction) {
            stack.sequence.push([firstWord, lineNumber]);
            stack.openClose[firstWord].push([firstWord, lineNumber, 'nicht geschlossen']);
        } else {
            for (var key in instruction) {
                if (instruction[key] != firstWord) {
                    continue;
                }
                stack.openClose[key].pop();
                if (stack.sequence.length == 0 || stack.sequence.pop()[0] != key) {
                    stack.errorMessage.push([firstWord, lineNumber, 'falsche Reihenfolge']);
                }
            }
        }
        if (firstWord == 'ELSE') {
            handleElse(firstWord, lineNumber, stack);
            continue;
        }
        if (firstWord == 'GROUP_BEGIN') {
            handleGroupBegin(firstWord, groupID, groupName, lineNumber, stack);
            continue;
        }
        if (firstWord == 'GROUP_END') {
            handleGroupEnd(firstWord, groupID, groupName, lineNumber, stack);
        }
    }
    for (var key in stack.openClose) {
        for (var i = 0; i < stack.openClose[key].length; i++) {
            stack.errorMessage.push(stack.openClose[key][i]);
        }
    }
    return printFaults(progName, stack.errorMessage);
}


function initializeError(){
    return {
        progName: '',
        lineNum: '',
        group: '',
        message: ''
    };
}



//============================================================
// Fehlerausgabe im Ausgabefenster
//============================================================
function printFaults(progamName, errorMessage) {
    var isFault = false;
    for (var i = 0; i < errorMessage.length; i++) {
        UltraEdit.outputWindow.write(`Im Programm >> ${progamName} >> ${errorMessage[i][0]} << ${errorMessage[i][2]} ==> Zeile ${errorMessage[i][1]}`);
        printOneFault(errorMessage[i]);
        UltraEdit.outputWindow.showWindow(true);
        isFault = true;
    }
    return isFault;
}

//============================================================
// Fehlerausgabe mit Zeilennummer als Link
//============================================================
function printOneFault(message) {
    var pathDoc = unescape(encodeURIComponent(UltraEdit.activeDocument.path));
    UltraEdit.outputWindow.write(`${pathDoc} (${message[1]}):`);
    UltraEdit.outputWindow.write("======================================================================");
}

//============================================================
// Programmaufruf
//============================================================
main()

