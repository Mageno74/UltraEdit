//============================================================
// Variablen 
//============================================================
var EINRUECKUNG = 2; // Einrückung für IF oder WHILE -> bei Bedarf ändern
var LEEREZEILEN = 1; // maximale Anzahl der leeren Zeilen -> bei Bedarf ändern
var STATNUMMER = 1000; // Startnummer -> bei Bedarf ändern
var INCREMENT = 5; // Inkrement -> bei Bedarf ändern
var regex = initializeRegex();
//============================================================

function main() {
    var stack = initializeStack();
    var lineData = initializeLineDitc();
    var doc = readDoc();

    var newDoc = prozessDoc(doc, stack, lineData);
    if (stack.errorMessage.length == 0) {
        if (UltraEdit.activeDocument){
            writeDoc(newDoc);
            UltraEdit.messageBox('erfolgreich nummeriert');
        }else{
            console.log(doc);
            createMessage('erfolgreich nummeriert');
        }
    } else {
        if (UltraEdit.activeDocument){
            printFaults(lineData.progName, stack.errorMessage);
            UltraEdit.messageBox('Fehler gefunden -> abgebrochen');
        }else{
            for (var i = 0; i < stack.errorMessage.length; i++) {
                createMessage('Error = ' + stack.errorMessage[i]);
            }
            createMessage('Fehler gefunden -> abgrbrochen');
        }
    }
}

function readDoc() {
    UltraEdit.insertMode();
    UltraEdit.columnModeOff();
    UltraEdit.outputWindow.clear();
    UltraEdit.activeDocument.selectAll();
    var doc = UltraEdit.activeDocument.selection;
    UltraEdit.activeDocument.cancelSelect();
    return doc.split(regex.lineEnd);
}

function writeDoc(doc) {
    var newDoc = doc.join('\r\n');
    UltraEdit.activeDocument.selectAll();
    UltraEdit.activeDocument.write(newDoc + '\r\n');
    UltraEdit.activeDocument.cancelSelect();
}

function initializeRegex() {
    return {
        lineNumer: /^\s*N\d+/i,
        comment: /;.*/,
        noNcCode: /^\s*(;|%|$)/,
        newProgram: /^%_N_/,
        string: /"[^"]*"/g,
        instruction: /^(\w*)\s*\(?\s*(\d+)?(.*)/i,
        closeInstruction: /^\b(ENDIF|ENDWHILE|ELSE|ENDLOOP|ENDFOR|UNTIL)\b/i,
        openInstruction: /^\b(IF|WHILE|ELSE|LOOP|FOR|REPEAT$)\b/i,
        gotoInstruction: /^.*\b(GOTO(F|B)?)\b/i,
        isHex: /^\s*@/,
        lineEnd: /\r?\n/
    };
}

function initializeInstruction() {
    return {
        'IF': 'ENDIF',
        'WHILE': 'ENDWHILE',
        'LOOP': 'ENDLOOP',
        'FOR': 'ENDFOR',
        'GROUP_BEGIN': 'GROUP_END',
        'REPEAT': 'UNTIL'
    };
}

function indentations() {
    var tabSize = '';
    for (var i = 0; i < EINRUECKUNG; i++) {
        tabSize += ' ';
    }
    return tabSize;
}

function prozessDoc(doc, stack, lineData) {
    var setting = getStartNumber();
    var instruction = initializeInstruction();
    var tab = indentations();
    var newDoc = [];

    lineData.lineNum = setting.start;

    for (var i = 0; i < doc.length; i++) {
        var line = doc[i];
        lineData.docLineNum = i + 1;
        if (checkIsHex(line)) {
            return false;
        }
        createMessage('name ' + lineData.progName)
        if (getProgName(lineData, setting, stack)){
            return newDoc;
        }
        prozessLine(line, lineData, stack, instruction);
        renumberDoc(line, lineData, newDoc, setting, tab);
    }
    for (var key in stack.openClose) {
        for (var i = 0; i < stack.openClose[key].length; i++) {
            stack.errorMessage.push(stack.openClose[key][i]);
        }
    }

    return newDoc;
}

function deleteEmptyLines(line, lineData, newDoc) {
    if (line.trim() == '') {
        lineData.emptyLines++;
    } else {
        lineData.emptyLines = 0;
    }
    if (lineData.emptyLines <= LEEREZEILEN) {
        newDoc.push(line);
    }
}

function checkIsHex(line) {
    if (regex.isHex.test(line)) {
        createMessage("Datei im HEX Format kann nicht nummeriert oder formatiert werden");
        return true;
    }
    return false;
}

function createMessage(message) {
    if (UltraEdit.activeDocument) {
        UltraEdit.outputWindow.write(message);
    } else {
        console.log(message);
    }
}

function getStartNumber() {
    if (UltraEdit.activeDocument) {
        var startNumber = parseInt(UltraEdit.getValue("Startnummer (Standard=" + STATNUMMER + ")", 1), 10);
        var increment = parseInt(UltraEdit.getValue("Increment (Standard=" + INCREMENT + ")", 1), 10);
    } else {
        var startNumber = 1000;
        var increment = 5;
    }

    if (isNaN(startNumber) || startNumber > 999999 || startNumber < 1) {
        startNumber = STATNUMMER;
    }
    if (isNaN(increment) || increment > 9999 || increment < 1) {
        increment = INCREMENT;
    }
    return { 'start': startNumber, 'inc': increment };
}

function parseLine(line, lineData) {
    lineData.orgNum = regex.lineNumer.exec(line);
    lineData.code = line.replace(regex.lineNumer, '')
        .replace(regex.comment, '');
    lineData.comment = regex.comment.exec(line);
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

function initializeLineDitc() {
    return {
        orgNum: '',
        code: '',
        comment: '',
        emptyLines: 0,
        progName: '',
        indentLevel: 0,
        lineNum: 0,
        docLineNum: 0
    };
}

function prozessLine(line, lineData, stack, instruction, newDoc) {
    parseLine(line, lineData);
    checkBrackets(lineData, stack);
    var resault = checkIsInstruction(lineData.code, instruction);
    if (resault) {
        checkIndentationSequence(resault, stack, instruction, lineData.docLineNum);
    }
}

function getProgName(lineData, setting, stack) {
    if (!lineData.progName) {
        if (UltraEdit.activeDocument) {
            lineData.progName = UltraEdit.activeDocument.path.replace(/.*\\/, "");
        } else {
            lineData.progName = 'unbekanntes Dokument';
        }
    }
    if (regex.newProgram.test(lineData.code)) {
        lineData.progName = lineData.code.replace(regex.newProgram, '');
        lineData.lineNum = setting.start;
        for (var key in stack.openClose) {
            for (var i = 0; i < stack.openClose[key].length; i++) {
                stack.errorMessage.push(stack.openClose[key][i]);
            }
        }
        if(stack.errorMessage.length != 0){
            return true;
        }
    }
    return false;
}

function checkIsInstruction(line, instruction) {
    var match = line.trim().match(regex.instruction);

    // Frühzeitiges Beenden bei GOTO-Instruktionen
    if (regex.gotoInstruction.test(line)) {
        return null;
    }
    // Frühzeitiges Beenden bei REPEAT
    if (match && match[1].toUpperCase() == 'REPEAT' && match[3] != '') {
        return null;
    }
    // Überprüfung auf gültige Instruktionen
    if (match) {
        var group_1 = match[1].toUpperCase() || '';
        var group_2 = match[2] || '';
        var group_3 = match[3] || '';
    }
    var instList = [];
    for (var key in instruction) {
        instList.push(instruction[key]);
    }
    if ((group_1 in instruction) || (instList.indexOf(group_1) != -1) || (group_1 == 'ELSE')) {
        return { firstWord: group_1, groupID: group_2, groupName: group_3 };
    }
    return null
}

function checkIndentationSequence(resault, stack, instruction, docLineNumber) {
    var firstWord = resault.firstWord;
    var groupID = resault.groupID;
    var groupName = resault.groupName;

    if (firstWord in instruction) {
        stack.sequence.push([firstWord, docLineNumber]);
        stack.openClose[firstWord].push([firstWord, docLineNumber, 'nicht geschlossen']);
    } else {
        for (var key in instruction) {
            if (instruction[key] != firstWord) {
                continue;
            }
            stack.openClose[key].pop();
            if (stack.sequence.length == 0 || stack.sequence.pop()[0] != key) {
                stack.errorMessage.push([firstWord, docLineNumber, 'falsche Reihenfolge']);
            }
        }
    }
    if (firstWord == 'ELSE') {
        handleElse(firstWord, docLineNumber, stack);
    }
    if (firstWord == 'GROUP_BEGIN') {
        handleGroupBegin(firstWord, groupID, groupName, docLineNumber, stack);
    }
    if (firstWord == 'GROUP_END') {
        handleGroupEnd(firstWord, groupID, groupName, docLineNumber, stack);
    }
}


function handleElse(firstWord, docLineNumber, stack) {
    if (stack.sequence.length == 0 || stack.sequence[stack.sequence.length - 1][0] != 'IF' ||
        stack.lastIf[stack.lastIf.length - 1] == stack.sequence[stack.sequence.length - 1][1]
    ) {
        stack.errorMessage.push([firstWord, docLineNumber, 'falsche Reihenfolge']);
    } else {
        stack.lastIf.push(stack.sequence[stack.sequence.length - 1][1]);
    }
}

function handleGroupBegin(firstWord, groupID, groupName, docLineNumber, stack) {
    if (stack.sequenceGroup.length != 0 && stack.sequenceGroup.indexOf(groupID) != -1) {
        stack.errorMessage.push([firstWord, docLineNumber, 'GROUP_BEGIN(' + groupID + groupName + ' hat bereits eine offene Gruppe']);
    }
    stack.group.push(['GROUP_BEGIN(' + groupID + groupName + ')', docLineNumber, 'nicht geschlossen']);
    stack.sequenceGroup.push(groupID);
}

function handleGroupEnd(firstWord, groupID, groupName, docLineNumber, stack) {
    if (stack.sequenceGroup.length == 0 || groupID != stack.sequenceGroup[stack.sequenceGroup.length - 1]) {
        stack.errorMessage.push([firstWord, docLineNumber, 'GROUP_END(' + groupID + groupName + ' in falscher Reihenfolge']);
    }
    stack.sequenceGroup.pop();
    stack.group.pop();
}

function checkBrackets(lineData, stack) {
    var stackBracket = [];
    var bracketes = {
        '(': ')',
        '{': '}',
        '[': ']'
    };
    var line = lineData.code.replace(regex.string, "");

    for (var n = 0; n < line.length; n++) {
        if (line[n] in bracketes) {
            stackBracket.push(line[n]);
            continue;
        }
        for (var key in bracketes) {
            if (bracketes[key] != line[n]) {
                continue;
            }
            if (stackBracket.length == 0 || key != stackBracket.pop()) {
                stack.errorMessage.push(['Klammer', lineData.docLineNum, 'nicht geöffnet']);
            }
        }
    }
    if (stackBracket.length != 0) {
        stack.errorMessage.push(['Klammer', lineData.docLineNum, 'nicht geschlossen']);
    }
}

function unchangeLine(oneLine) {
    if (regex.noNcCode.test(oneLine)) {
        oneLine = oneLine.trim();
        return oneLine;
    }
    return false;
}

function renumberDoc(line, lineData, newDoc, setting, tab) {
    var step = setting.inc;

    var result = unchangeLine(line);
    if ((result) != false) {
        newDoc.push(result);
        return;
    }
    line = line.replace(regex.lineNumer, '');

    if (lineData.code || (lineData.orgNum && lineData.comment)) {
        line = line.trim();
        if (regex.closeInstruction.test(line) && lineData.indentLevel > 0) {
            lineData.indentLevel--;
        }
        var space = ' ';
        for (var n = 0; n < lineData.indentLevel; n++) {
            space += tab;
        }
        if ((regex.openInstruction.test(line) && !regex.gotoInstruction.test(line))) {
            lineData.indentLevel++;
        }
    }
    if (line) {
        line = 'N' + lineData.lineNum + space + line;
        newDoc.push(line);
        lineData.lineNum += step;
        lineData.emptyLines = 0;
        return;
    }
    deleteEmptyLines(line, lineData, newDoc)
}

function printFaults(progamName, errorMessage) {
    var isFault = false;
    for (var i = 0; i < errorMessage.length; i++) {
        createMessage('Im Programm >> ' + progamName + ' >> ' + errorMessage[i][0] + ' << ' + errorMessage[i][2] + ' ==> Zeile ' + errorMessage[i][1]);
        printOneFault(errorMessage[i]);
        if (UltraEdit.activeDocument) {
            UltraEdit.outputWindow.showWindow(true);
        }
        isFault = true;
    }
    return isFault;
}

function printOneFault(message) {
    if (UltraEdit.activeDocument) {
        var pathDoc = unescape(encodeURIComponent(UltraEdit.activeDocument.path));
    } else {
        var pathDoc = 'unbekanntes Dokument';
    }
    createMessage(pathDoc + "(" + message[1] + "): ");
    createMessage("======================================================================");
}

main()