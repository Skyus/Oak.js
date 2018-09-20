class VirtualOS {
    ecall(core) {
        let service = core.registerFile.read(core.virtualOSServiceRegister);
        let args = [];
        for (let i = core.virtualOSArgumentVectorStart; i <= core.virtualOSArgumentVectorEnd; i += 1) {
            args.push(core.registerFile.read(i));
        }
        switch (service) {
            case 1:
                this.outputInt(args[0]);
                break;
            case 4:
                let iterator = args[0];
                let array = [];
                let char = null;
                do {
                    char = core.memcpy(iterator, 1)[0];
                    array.push(char);
                    iterator += 1;
                } while (char !== 0);
                let outStr = array.map(c => String.fromCharCode(c)).join('');
                this.outputString(outStr);
            case 10:
                return "HALT";
        }
        let j = 0;
        for (let i = core.virtualOSArgumentVectorStart; i <= core.virtualOSArgumentVectorEnd; i += 1) {
            core.registerFile.write(i, args[j]);
            j += 1;
        }
        return null;
    }
}
class Core {
    memcpy(address, bytes) {
        if (((address + bytes) >>> 0) > this.memorySize) {
            return null;
        }
        let result = [];
        for (let i = 0; i < bytes; i++) {
            result.push(this.memory[address + i]);
        }
        return result;
    }
    memset(address, bytes) {
        if (address < 0) {
            return false;
        }
        if (address + bytes.length > this.memorySize) {
            return false;
        }
        for (let i = 0; i < bytes.length; i++) {
            this.memory[address + i] = bytes[i];
        }
        return true;
    }
    decode() {
        let insts = this.instructionSet.instructions;
        this.decoded = null;
        this.arguments = [];
        for (let i = 0; i < insts.length; i++) {
            if (insts[i].match(this.fetched)) {
                this.decoded = insts[i];
                break;
            }
        }
        if (this.decoded == null) {
            return null;
        }
        let bitRanges = this.decoded.format.ranges;
        for (let i in bitRanges) {
            let range = bitRanges[i];
            if (range.parameter != null) {
                let limit = range.limitStart;
                let value = ((this.fetched >>> range.start) & ((1 << range.bits) - 1)) << limit;
                if (range.parameterType === Parameter.special) {
                    value = this.decoded.format.decodeSpecialParameter(value, this.pc);
                }
                this.arguments[range.parameter] = this.arguments[range.parameter] || 0;
                this.arguments[range.parameter] = this.arguments[range.parameter] | value;
                if (this.decoded.format.ranges[i].signed && range.parameterType !== Parameter.register) {
                    this.arguments[range.parameter] = Utils.signExt(this.arguments[range.parameter], range.totalBits ? range.totalBits : range.bits);
                }
            }
        }
        return this.instructionSet.disassemble(this.decoded, this.arguments);
    }
    execute() {
        return this.decoded.executor(this);
    }
}
var Parameter;
(function (Parameter) {
    Parameter[Parameter["immediate"] = 0] = "immediate";
    Parameter[Parameter["register"] = 1] = "register";
    Parameter[Parameter["condition"] = 2] = "condition";
    Parameter[Parameter["offset"] = 3] = "offset";
    Parameter[Parameter["special"] = 4] = "special";
    Parameter[Parameter["fpImmediate"] = 5] = "fpImmediate";
})(Parameter || (Parameter = {}));
;
var Endianness;
(function (Endianness) {
    Endianness[Endianness["little"] = 0] = "little";
    Endianness[Endianness["big"] = 1] = "big";
    Endianness[Endianness["bi"] = 2] = "bi";
})(Endianness || (Endianness = {}));
;
var Keyword;
(function (Keyword) {
    Keyword[Keyword["directive"] = 0] = "directive";
    Keyword[Keyword["comment"] = 1] = "comment";
    Keyword[Keyword["label"] = 2] = "label";
    Keyword[Keyword["stringMarker"] = 3] = "stringMarker";
    Keyword[Keyword["charMarker"] = 4] = "charMarker";
    Keyword[Keyword["register"] = 5] = "register";
    Keyword[Keyword["string"] = 6] = "string";
    Keyword[Keyword["char"] = 7] = "char";
    Keyword[Keyword["numeric"] = 8] = "numeric";
})(Keyword || (Keyword = {}));
;
var Directive;
(function (Directive) {
    Directive[Directive["text"] = 0] = "text";
    Directive[Directive["data"] = 1] = "data";
    Directive[Directive["string"] = 2] = "string";
    Directive[Directive["cString"] = 3] = "cString";
    Directive[Directive["_8bit"] = 4] = "_8bit";
    Directive[Directive["_16bit"] = 5] = "_16bit";
    Directive[Directive["_32bit"] = 6] = "_32bit";
    Directive[Directive["_64bit"] = 7] = "_64bit";
    Directive[Directive["fixedPoint"] = 8] = "fixedPoint";
    Directive[Directive["floatingPoint"] = 9] = "floatingPoint";
    Directive[Directive["custom"] = 10] = "custom";
})(Directive || (Directive = {}));
;
class BitRange {
    get end() {
        return this.start + this.bits - 1;
    }
    constructor(field, start, bits, constant = null, signed = false) {
        this.field = field;
        this.start = start;
        this.bits = bits;
        this.constant = constant;
        this.signed = signed;
    }
    limited(totalBits, limitStart = null, limitEnd = null) {
        this.totalBits = totalBits;
        this.limitStart = limitStart;
        this.limitEnd = limitEnd;
        return this;
    }
    parameterized(parameter, parameterType, parameterDefaultValue = null) {
        this.parameter = parameter;
        this.parameterDefaultValue = parameterDefaultValue;
        this.parameterType = parameterType;
        return this;
    }
}
;
class Format {
    constructor(ranges, regex, disassembly, processSpecialParameter = null, decodeSpecialParameter = null) {
        this.ranges = ranges;
        this.regex = regex;
        this.disassembly = disassembly;
        this.processSpecialParameter = processSpecialParameter;
        this.decodeSpecialParameter = decodeSpecialParameter;
    }
}
;
class Instruction {
    constructor(mnemonic, format, constants, constValues, executor, signatoryOverride = null, pseudoInstructionFor = []) {
        this.computedBits = null;
        this.computedMask = null;
        this.computedTemplate = null;
        this.mnemonic = mnemonic;
        this.format = format;
        this.constants = [];
        for (let i in constants) {
            this.constants[constants[i]] = constValues[i];
        }
        this.executor = executor;
        this.signatoryOverride = signatoryOverride;
        this.pseudoInstructionFor = pseudoInstructionFor;
    }
    pad(str, length) {
        let padded = str;
        for (let i = 0; i < length - str.length; i++) {
            padded = "0" + padded;
        }
        return padded;
    }
    get bits() {
        if (this.computedBits !== null) {
            return this.computedBits;
        }
        let count = 0;
        for (var i in this.format.ranges) {
            count += this.format.ranges[i].bits;
        }
        this.computedBits = count;
        return this.computedBits;
    }
    get bytes() {
        return Math.ceil(this.bits / 8);
    }
    get mask() {
        if (this.computedMask !== null) {
            return this.computedMask;
        }
        var string = '';
        for (let i = 0; i < this.bits; i += 1) {
            string += 'X';
        }
        for (let i in this.format.ranges) {
            let range = this.format.ranges[i];
            let constant = this.constants[range.field];
            if (constant == null) {
                constant = range.constant;
            }
            if (constant != null) {
                let before = string.substr(0, this.bits - range.end - 1);
                let addition = Utils.pad(constant, range.bits, 2);
                let after = range.start == 0 ? '' : string.substr(-range.start);
                string = before + addition + after;
            }
        }
        this.computedMask = string;
        return this.computedMask;
    }
    ;
    match(machineCode) {
        let machineCodeMutable = machineCode >>> 0;
        let maskBits = this.mask.split("");
        for (let i = this.bits - 1; i >= 0; i--) {
            let bit = (machineCodeMutable & 1);
            machineCodeMutable >>= 1;
            if (maskBits[i] === "X") {
                continue;
            }
            if (parseInt(maskBits[i]) !== bit) {
                return false;
            }
        }
        return true;
    }
    get template() {
        if (this.computedTemplate != null) {
            return this.computedTemplate;
        }
        let temp = 0 >>> 0;
        for (let i in this.format.ranges) {
            let range = this.format.ranges[i];
            let constant = this.constants[range.field];
            if (constant == null) {
                constant = range.constant;
            }
            if (constant != null) {
                temp |= (constant << range.start);
            }
        }
        this.computedTemplate = temp;
        return temp;
    }
    ;
}
;
class PseudoInstruction {
}
;
class InstructionSet {
    pseudoMnemonicSearch(mnemonic) {
        return -1;
    }
    mnemonicSearch(mnemonic) {
        for (let i = 0; i < this.instructions.length; i++) {
            if (this.instructions[i].mnemonic == mnemonic) {
                return i;
            }
        }
        return -1;
    }
    instructionsPrefixing(line) {
        var result = [];
        for (let i in this.instructions) {
            let instruction = this.instructions[i];
            if (line.toUpperCase().hasPrefix(instruction.mnemonic)) {
                let captures = instruction.format.regex.exec(line);
                if (captures && captures[1].toUpperCase() == instruction.mnemonic) {
                    result.push(instruction);
                }
            }
        }
        return result;
    }
    disassemble(instruction, args) {
        let output = instruction.format.disassembly;
        output = output.replace("@mnem", instruction.mnemonic);
        for (let i = 0; i < instruction.format.ranges.length; i++) {
            let range = instruction.format.ranges[i];
            let parameter = range.parameter;
            if (parameter != null) {
                output = output.replace("@arg" + range.parameter, (range.parameterType === Parameter.register) ? this.abiNames[args[parameter]] : args[parameter].toString());
            }
        }
        return output;
    }
    constructor(name, bits, formats, instructions, pseudoInstructions, abiNames, keywords, directives, exampleCode) {
        this.name = name;
        this.bits = bits;
        this.formats = formats;
        this.instructions = instructions;
        instructions.sort((a, b) => a.bytes - b.bytes);
        this.pseudoInstructions = pseudoInstructions;
        this.abiNames = abiNames;
        this.keywords = keywords;
        this.directives = directives;
        this.exampleCode = exampleCode;
    }
}
;
var Utils;
(function (Utils) {
    function signExt(value, bits) {
        let mutableValue = value;
        if ((mutableValue & (1 << (bits - 1))) !== 0) {
            mutableValue = ((~(0) >>> bits) << bits) | value;
        }
        return mutableValue;
    }
    Utils.signExt = signExt;
    function rangeCheck(value, bits) {
        if (bits >= 32) {
            return null;
        }
        var min = -(1 << bits - 1);
        var max = (1 << bits - 1) - 1;
        value = signExt(value, bits);
        if ((min <= (value >> 0)) && ((value >> 0) <= max)) {
            return true;
        }
        return false;
    }
    Utils.rangeCheck = rangeCheck;
    function catBytes(bytes, bigEndian = false) {
        if (bytes.length > 4) {
            return null;
        }
        if (bigEndian) {
            bytes.reverse();
        }
        let storage = 0 >>> 0;
        for (let i = 0; i < bytes.length; i++) {
            storage = storage | (bytes[i] << (8 * i));
        }
        return storage;
    }
    Utils.catBytes = catBytes;
    function pad(number, digits, radix) {
        let padded = number.toString(radix);
        while (digits > padded.length) {
            padded = "0" + padded;
        }
        return padded;
    }
    Utils.pad = pad;
    function hex(array) {
        let hexadecimal = "";
        for (let i = 0; i < array.length; i++) {
            let hexRepresentation = array[i].toString(16).toUpperCase();
            if (hexRepresentation.length === 1) {
                hexRepresentation = "0" + hexRepresentation;
            }
            hexadecimal += hexRepresentation + " ";
        }
        return hexadecimal;
    }
    Utils.hex = hex;
})(Utils || (Utils = {}));
String.prototype.interpretedBytes = function () {
    let hexes = this.split(' ');
    let bytes = [];
    for (let i = 0; i < hexes.length; i++) {
        let value = parseInt(hexes[i], 16);
        if (!isNaN(value)) {
            bytes.push(value);
        }
    }
    return bytes;
};
String.prototype.hasPrefix = function (needle) {
    return this.substr(0, needle.length) === needle;
};
var Kind;
(function (Kind) {
    Kind[Kind["instruction"] = 0] = "instruction";
    Kind[Kind["data"] = 1] = "data";
    Kind[Kind["directive"] = 2] = "directive";
    Kind[Kind["noise"] = 3] = "noise";
})(Kind || (Kind = {}));
;
class Line {
    constructor(raw, number) {
        this.addressThisPass = null;
        this.sensitive = false;
        this.machineCode = [];
        this.raw = raw;
        this.number = number;
        this.kind = Kind.noise;
        this.sensitivityList = [];
        this.possibleInstructions = [];
    }
    static arrayFromFile(file) {
        return file.split('\n').map((line, index) => new Line(line, index));
    }
    initialProcess(assembler, text = true) {
        let comment = assembler.keywordRegexes[Keyword.comment];
        let tmp = comment.exec(this.raw)[1];
        let label = assembler.keywordRegexes[Keyword.label];
        let pieces = label.exec(tmp);
        this.label = pieces[1];
        this.processed = pieces[2] || '';
        if (/^s*$/.exec(this.processed) !== null) {
            return text;
        }
        if (assembler.keywordRegexes[Keyword.directive] != null) {
            let captures = RegExp(assembler.keywordRegexes[Keyword.directive]).exec(this.processed);
            if (captures !== null) {
                this.directive = assembler.directives[captures[1]];
                this.directiveData = captures[2];
            }
        }
        if (text) {
            if (this.directive !== undefined) {
                switch (this.directive) {
                    case Directive.data:
                        this.kind = Kind.directive;
                        return false;
                    case Directive.text:
                        this.kind = Kind.directive;
                        break;
                    default:
                        this.invalidReason = "text.unsupportedDirective";
                }
                return true;
            }
            this.kind = Kind.instruction;
            assembler.instructionSet.instructions.forEach(instruction => {
                let match = instruction.format.regex.exec(this.processed);
                if (match !== null && match[1].toUpperCase() === instruction.mnemonic) {
                    this.possibleInstructions.push([instruction, match.slice(2), [], null]);
                }
                return match !== null;
            });
            if (this.possibleInstructions.length === 0) {
                this.invalidReason = "text.noMatchingInstructions";
                return true;
            }
            let minimum = this.possibleInstructions[0][0].bytes;
            (this.machineCode = []).length = minimum;
            this.machineCode.fill(0);
            return true;
        }
        else {
            let count = null;
            let zeroDelimitedString = 0;
            if (this.directive !== undefined) {
                this.kind = Kind.data;
                switch (this.directive) {
                    case Directive.data:
                        this.kind = Kind.directive;
                        break;
                    case Directive.text:
                        this.kind = Kind.directive;
                        return true;
                        break;
                    case Directive._32bit:
                        count = count || 4;
                    case Directive._16bit:
                        count = count || 2;
                    case Directive._8bit:
                        count = count || 1;
                        let elements = this.directiveData.split(/\s*,\s*/);
                        (this.machineCode = []).length = (elements.length * count);
                        this.machineCode.fill(0);
                        this.kind = Kind.data;
                        break;
                    case Directive.cString:
                        zeroDelimitedString = 1;
                    case Directive.string:
                        if (assembler.keywordRegexes[Keyword.string] === null) {
                            this.invalidReason = "isa.noStringTokenDefined";
                        }
                        let match = assembler.keywordRegexes[Keyword.string].exec(this.directiveData);
                        if (match === null) {
                            this.invalidReason = "data.invalidString";
                        }
                        else {
                            let regex = RegExp(assembler.generalCharacters, "g");
                            let characters = [];
                            let found = null;
                            while (found = regex.exec(match[1])) {
                                characters.push(found);
                            }
                            (this.machineCode = []).length = (characters.length + zeroDelimitedString);
                            for (let c in characters) {
                                let character = String(characters[c]);
                                let value = character.charCodeAt(0);
                                if (character.length > 2) {
                                    value = Assembler.escapedCharacters[character[1]];
                                }
                                this.machineCode[c] = value;
                            }
                            if (zeroDelimitedString === 1) {
                                this.machineCode[this.machineCode.length - 1] = 0;
                            }
                        }
                        this.kind = Kind.data;
                        break;
                    default:
                        this.invalidReason = "data.unrecognizedDirective";
                }
            }
            else {
                let isInstruction = false;
                assembler.instructionSet.instructions.forEach(instruction => {
                    let match = instruction.format.regex.exec(this.processed);
                    if (match !== null && match[1].toUpperCase() === instruction.mnemonic) {
                        isInstruction = true;
                    }
                });
                if (isInstruction) {
                    this.invalidReason = "data.instruction";
                }
                else {
                    this.invalidReason = "data.unknownInput";
                }
            }
            return false;
        }
    }
    assembleText(assembler, lines, address) {
        let candidates = false;
        testingInstructions: for (let i in this.possibleInstructions) {
            let possibleInstruction = this.possibleInstructions[i];
            let instruction = possibleInstruction[0];
            let args = possibleInstruction[1];
            let machineCode = instruction.template;
            for (var j in instruction.format.ranges) {
                let range = instruction.format.ranges[j];
                if (range.parameter === undefined) {
                    continue;
                }
                let limited = range.totalBits;
                let bits = limited || range.bits;
                let store = assembler.process(args[range.parameter], range.parameterType, bits, address, instruction.bytes);
                if (store.errorMessage !== null) {
                    possibleInstruction[3] = store.errorMessage;
                    continue testingInstructions;
                }
                else if (store.context !== null && store.value === null) {
                    store.context.sensitivityList.push(this);
                    this.sensitive = true;
                    break testingInstructions;
                }
                else {
                    let register = store.value;
                    let startBit = range.limitStart;
                    let endBit = range.limitEnd;
                    if (limited !== undefined && startBit !== undefined && endBit !== undefined) {
                        register >>= startBit;
                        let bits = (endBit - startBit + 1);
                        register &= (1 << bits) - 1;
                    }
                    machineCode |= register << range.start;
                }
            }
            for (let i = 0; i < instruction.bytes; i += 1) {
                possibleInstruction[2].push(machineCode & 0xFF);
                machineCode >>>= 8;
            }
            candidates = true;
        }
        if (candidates) {
            let smallestPossibleInstruction = this.possibleInstructions.filter(pi => pi[3] === null)[0];
            this.machineCode = smallestPossibleInstruction[2];
        }
        let errorMessage = null;
        let errorOccurred = !(candidates || this.sensitive);
        if (errorOccurred) {
            errorMessage = this.possibleInstructions[this.possibleInstructions.length - 1][3];
        }
        return errorMessage;
    }
    assembleData(assembler, lines, address) {
        let errorMessage = null;
        let count = null;
        switch (this.directive) {
            case Directive._32bit:
                count = count || 4;
            case Directive._16bit:
                count = count || 2;
            case Directive._8bit:
                count = count || 1;
                let elements = this.directiveData.split(/\s*,\s*/);
                testingElements: for (let i = 0; i < elements.length; i += 1) {
                    let element = elements[i];
                    let bits = count << 3;
                    let store = assembler.process(element, Parameter.immediate, bits, address, 0);
                    if (store.errorMessage !== null) {
                        errorMessage = store.errorMessage;
                        break testingElements;
                    }
                    else if (store.context !== null && store.value === null) {
                        store.context.sensitivityList.push(this);
                        this.sensitive = true;
                        break testingElements;
                    }
                    else {
                        let stored = store.value;
                        for (let j = 0; j < count; j += 1) {
                            let offset = (count * i);
                            this.machineCode[j + offset] = stored & 0xFF;
                            stored >>>= 8;
                        }
                    }
                }
                break;
            case Directive.cString:
            case Directive.string:
                break;
            default:
                this.invalidReason = "data.unrecognizedDirective";
        }
        return errorMessage;
    }
    assemble(assembler, lines, address) {
        this.sensitive = false;
        let result = [null, false];
        switch (this.kind) {
            case Kind.instruction:
                result[0] = this.assembleText(assembler, lines, address);
                break;
            case Kind.data:
                result[0] = this.assembleData(assembler, lines, address);
        }
        let lineByLabel = assembler.linesByLabel[this.label];
        if (lineByLabel !== undefined) {
            lineByLabel[1] = address;
        }
        if (result[0] === null) {
            sensitiveList: for (let i in this.sensitivityList) {
                let sensor = this.sensitivityList[i];
                if (sensor.addressThisPass !== null) {
                    let sensorLength = sensor.machineCode.length;
                    let newAssembly = sensor.assemble(assembler, lines, sensor.addressThisPass);
                    if (sensor.sensitive) {
                    }
                    else {
                        if (newAssembly[1]) {
                            result[1] = true;
                            break sensitiveList;
                        }
                        if (sensor.machineCode.length !== sensorLength) {
                            result[1] = true;
                            break sensitiveList;
                        }
                    }
                }
            }
        }
        else {
            this.invalidReason = result[0];
        }
        return result;
    }
}
class Assembler {
    constructor(instructionSet, endianness, memoryMap = null) {
        this.linesByLabel = [];
        this.incrementOnFetch = instructionSet.incrementOnFetch;
        this.keywordRegexes = [];
        this.memoryMap = memoryMap;
        if (instructionSet.keywordRegexes) {
            this.keywordRegexes = instructionSet.keywordRegexes;
        }
        else if (instructionSet.keywords) {
            let words = instructionSet.keywords;
            this.keywordRegexes = [];
            if (words[Keyword.directive]) {
                let options = Assembler.options(instructionSet.keywords[Keyword.directive]);
                if (options) {
                    this.keywordRegexes[Keyword.directive] = RegExp(options + "([^\\s]+)\\s*(.+)*");
                }
            }
            if (words[Keyword.comment]) {
                let options = Assembler.options(words[Keyword.comment]);
                if (options) {
                    this.keywordRegexes[Keyword.comment] = RegExp("^(.*?)(" + options + ".*)?$");
                }
            }
            if (words[Keyword.label]) {
                let options = Assembler.options(words[Keyword.label]);
                if (options) {
                    this.keywordRegexes[Keyword.label] = RegExp("^(?:([A-Za-z_][A-Za-z0-9_]*)" + options + ")?\\s*(.*)?$");
                }
            }
            if (words[Keyword.register]) {
                let options = Assembler.options(words[Keyword.register]);
                if (options) {
                    this.keywordRegexes[Keyword.register] = RegExp(options + "([0-9]+)");
                }
            }
            this.keywordRegexes[Keyword.numeric] = RegExp("(-?(?:0([" + Assembler.radixList + "]))?[A-F0-9]+)");
            if (words[Keyword.charMarker]) {
                let options = Assembler.options(words[Keyword.charMarker]);
                if (options) {
                    let escapable = options.length > 1 ? "" : "\\" + options;
                    this.generalCharacters = "(?:(?:\\\\[\\\\" + Assembler.escapedCharacterList + escapable + "])|(?:[\\x20-\\x5b\\x5d-\\x7e]))";
                    this.keywordRegexes[Keyword.char] = RegExp(options + '(' + this.generalCharacters + ')' + options);
                }
            }
            else {
                this.generalCharacters = "(?:(?:\\\\[\\\\" + Assembler.escapedCharacterList + "])|(?:[\\x20-\\x5b\\x5d-\\x7e]))";
            }
            if (words[Keyword.stringMarker]) {
                let options = Assembler.options(words[Keyword.stringMarker]);
                if (options) {
                    this.keywordRegexes[Keyword.string] = RegExp(options + "(" + this.generalCharacters + "*)" + options);
                }
            }
        }
        else {
            console.log("INSTRUCTION SET WARNING: This instruction set doesn't define any keywords.");
        }
        this.directives = instructionSet.directives;
        this.endianness = (endianness) ? endianness : instructionSet.endianness;
        this.instructionSet = instructionSet;
    }
    process(text, type, bits, address, instructionLength) {
        let result = {
            errorMessage: null,
            value: null,
            context: null
        };
        switch (type) {
            case Parameter.register:
                let index = this.instructionSet.abiNames.indexOf(text);
                if (index !== -1) {
                    result.value = index;
                    return result;
                }
                let registerNo = null;
                if (this.keywordRegexes[Keyword.register]) {
                    registerNo = new RegExp(this.keywordRegexes[Parameter.register]).exec(text)[1];
                }
                else {
                    result.errorMessage = `args.registerDoesNotExist(${text})`;
                    return result;
                }
                registerNo = parseInt(registerNo);
                if ((registerNo & (~0 << bits)) !== 0) {
                    result.errorMessage = `args.registerDoesNotExist(${text})`;
                    return result;
                }
                result.value = registerNo;
                return result;
            case Parameter.offset:
            case Parameter.immediate:
                let value = null;
                let reference = this.linesByLabel[text];
                if (reference !== undefined) {
                    result.context = reference[0];
                    if (reference[1] === null) {
                        return result;
                    }
                    value = reference[1];
                }
                if (value === null && this.keywordRegexes[Keyword.char]) {
                    let extraction = RegExp(this.keywordRegexes[Keyword.char]).exec(text);
                    if (extraction !== null && extraction[1] !== undefined) {
                        value = extraction[1].charCodeAt(0);
                        if (value > 255) {
                            result.errorMessage = "Non-ascii character " + extraction[1] + " unsupported.";
                            return result;
                        }
                    }
                }
                if (value === null && this.keywordRegexes[Keyword.numeric] !== undefined) {
                    let array = RegExp(this.keywordRegexes[Keyword.numeric]).exec(text);
                    if (array !== null) {
                        let radix = Assembler.radixes[array[2]] || 10;
                        let interpretable = array[1];
                        value = parseInt(interpretable, radix);
                    }
                }
                if (value !== null && type === Parameter.offset) {
                    value -= address;
                    if (this.incrementOnFetch) {
                        value += instructionLength;
                    }
                }
                if (value === null || isNaN(value)) {
                    result.errorMessage = `args.valueUnrecognized(${text})`;
                    return result;
                }
                else if (Utils.rangeCheck(value, bits) === false) {
                    result.errorMessage = `args.outOfRange(${text})`;
                    return result;
                }
                result.value = value;
                return result;
            default:
                result.errorMessage = "oak.paramUnsupported";
                return result;
        }
    }
    static options(list) {
        if (list.length == 0) {
            return null;
        }
        let options = "";
        for (let i = 0; i < list.length; i++) {
            let keyword = list[i];
            if (keyword == "\\") {
                console.log("INSTRUCTION SET WARNING: '\\' used as keyword. This behavior is undefined.");
                return null;
            }
            if (options == "") {
                options = "(?:";
            }
            else {
                options += "|";
            }
            options += keyword;
        }
        return options + ")";
    }
    assemble(lines, pass) {
        lines.map(line => line.addressThisPass = null);
        let errors = [];
        let assemblerModeText = true;
        let address = 0;
        for (var i in lines) {
            let line = lines[i];
            switch (pass) {
                case 0:
                    assemblerModeText = line.initialProcess(this, assemblerModeText);
                    if (line.invalidReason !== undefined) {
                        errors.push(line);
                    }
                    if (line.label !== undefined) {
                        this.linesByLabel[line.label] = [line, null];
                    }
                    break;
                default:
                    line.addressThisPass = address;
                    let asm = line.assemble(this, lines, address);
                    if (asm[0] !== null) {
                        errors.push(line);
                    }
                    if (asm[1]) {
                        return null;
                    }
                    address += line.machineCode.length;
            }
        }
        return errors;
    }
}
Assembler.radixes = {
    'b': 2,
    'o': 8,
    'd': 10,
    'h': 16
};
Assembler.radixList = Object.keys(Assembler.radixes).join("");
Assembler.escapedCharacters = {
    '0': 0,
    't': 9,
    'n': 10,
    'r': 13,
    '\'': 47,
    '\"': 42
};
Assembler.escapedCharacterList = Object.keys(Assembler.escapedCharacters).join("");
function MIPS(options) {
    let formats = [];
    let instructions = [];
    let pseudoInstructions = [];
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(1, Parameter.register),
        new BitRange("rt", 16, 5).parameterized(2, Parameter.register),
        new BitRange("rd", 11, 5).parameterized(0, Parameter.register),
        new BitRange("shamt", 6, 5, 0),
        new BitRange("funct", 0, 6)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)/, "@mnem @arg0, @arg1, @arg2"));
    let rType = formats[formats.length - 1];
    instructions.push(new Instruction("ADD", rType, ["opcode", "funct"], [0x0, 0x20], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("ADDU", rType, ["opcode", "funct"], [0x0, 0x21], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("SUB", rType, ["opcode", "funct"], [0x0, 0x22], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) - core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("SUBU", rType, ["opcode", "funct"], [0x0, 0x23], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) - core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("AND", rType, ["opcode", "funct"], [0x0, 0x24], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) & core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("OR", rType, ["opcode", "funct"], [0x0, 0x25], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) | core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("NOR", rType, ["opcode", "funct"], [0x0, 0x27], function (core) {
        core.registerFile.write(core.arguments[0], ~(core.registerFile.read(core.arguments[1]) | core.registerFile.read(core.arguments[2])));
        return null;
    }));
    instructions.push(new Instruction("XOR", rType, ["opcode", "funct"], [0x0, 0x26], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) ^ core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("SLT", rType, ["opcode", "funct"], [0x0, 0x2A], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) < core.registerFile.read(core.arguments[2])) ? 1 : 0);
        return null;
    }));
    instructions.push(new Instruction("SLLV", rType, ["opcode", "funct"], [0x0, 0x04], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) << core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("SRLV", rType, ["opcode", "funct"], [0x0, 0x06], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >>> core.registerFile.read(core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("SRAV", rType, ["opcode", "funct"], [0x0, 0x07], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >> core.registerFile.read(core.arguments[2]));
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(0, Parameter.register),
        new BitRange("rt", 16, 5, 0),
        new BitRange("rd", 11, 5, 0),
        new BitRange("shamt", 6, 5, 0),
        new BitRange("funct", 0, 6)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)/, "@mnem @arg0"));
    let rjSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("JR", rjSubtype, ["opcode", "funct"], [0x0, 0x08], function (core) {
        core.pc = core.registerFile.read(core.arguments[0]);
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5, 0),
        new BitRange("rt", 16, 5).parameterized(1, Parameter.register),
        new BitRange("rd", 11, 5).parameterized(0, Parameter.register),
        new BitRange("shamt", 6, 5).parameterized(2, Parameter.immediate),
        new BitRange("funct", 0, 6)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)\s*,\s*([0-9]+)/, "@mnem @arg0, @arg1, @arg2"));
    let rsSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("SLL", rsSubtype, ["opcode", "funct"], [0x0, 0x00], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) << core.arguments[2]);
        return null;
    }));
    instructions.push(new Instruction("SRL", rsSubtype, ["opcode", "funct"], [0x0, 0x02], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >>> core.arguments[2]);
        return null;
    }));
    instructions.push(new Instruction("SRA", rsSubtype, ["opcode", "funct"], [0x0, 0x02], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >> core.arguments[2]);
        return null;
    }));
    formats.push(new Format([
        new BitRange("funct", 0, 32)
    ], /[a-zA-Z]+/, "@mnem"));
    let rcSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("SYSCALL", rcSubtype, ["funct"], [0xC], function (core) {
        core.virtualOS.ecall(core);
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(1, Parameter.register),
        new BitRange("rt", 16, 5).parameterized(0, Parameter.register),
        new BitRange("imm", 0, 16, null, true).parameterized(2, Parameter.immediate)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)\s*,\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1, @arg2"));
    let iType = formats[formats.length - 1];
    instructions.push(new Instruction("ADDI", iType, ["opcode"], [0x8], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.arguments[2]);
        return null;
    }));
    instructions.push(new Instruction("ADDIU", iType, ["opcode"], [0x9], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.arguments[2]);
        return null;
    }));
    instructions.push(new Instruction("SLTI", iType, ["opcode"], [0x0A], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) < core.arguments[2]) ? 1 : 0);
        return null;
    }));
    instructions.push(new Instruction("SLTIU", iType, ["opcode"], [0x0B], function (core) {
        core.registerFile.write(core.arguments[0], ((core.registerFile.read(core.arguments[1]) >>> 0) < (core.arguments[2] >>> 0) ? 1 : 0));
        return null;
    }));
    instructions.push(new Instruction("ANDI", iType, ["opcode"], [0x0C], function (core) {
        core.registerFile.write(core.arguments[0], ((core.registerFile.read(core.arguments[1]) >>> 0) & core.arguments[2]));
        return null;
    }));
    instructions.push(new Instruction("ORI", iType, ["opcode"], [0x0D], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) >>> 0) | core.arguments[2]);
        return null;
    }));
    instructions.push(new Instruction("XORI", iType, ["opcode"], [0x0E], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) >>> 0) ^ core.arguments[2]);
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(0, Parameter.register),
        new BitRange("rt", 16, 5).parameterized(1, Parameter.register),
        new BitRange("imm", 0, 16, null, true).parameterized(2, Parameter.immediate).limited(18, 2, 17)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)\s*,\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1, @arg2"));
    let ibSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("BEQ", ibSubtype, ["opcode"], [0x04], function (core) {
        if (core.registerFile.read(core.arguments[0]) === core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        return null;
    }));
    instructions.push(new Instruction("BNE", ibSubtype, ["opcode"], [0x05], function (core) {
        if (core.registerFile.read(core.arguments[0]) !== core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5, 0),
        new BitRange("rt", 16, 5).parameterized(0, Parameter.register),
        new BitRange("imm", 0, 16, null, true).parameterized(1, Parameter.register)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1"));
    let iluiSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("LUI", iluiSubtype, ["opcode"], [0x0F], function (core) {
        core.registerFile.write(core.arguments[0], (core.arguments[1] << 16));
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(2, Parameter.register),
        new BitRange("rt", 16, 5).parameterized(0, Parameter.register),
        new BitRange("imm", 0, 16, null, true).parameterized(1, Parameter.immediate)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(-?0?[boxd]?[0-9A-F]+)\(\s*(\$[A-Za-z0-9]+)\s*\)/, "@mnem @arg0, @arg1(@arg2)"));
    let ilsSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("LB", ilsSubtype, ["opcode"], [0x20], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 1);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.signExt(bytes[0], 8));
        return null;
    }));
    instructions.push(new Instruction("LH", ilsSubtype, ["opcode"], [0x21], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 2);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.signExt(Utils.catBytes(bytes), 16));
        return null;
    }));
    instructions.push(new Instruction("LW", ilsSubtype, ["opcode"], [0x23], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 4);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.catBytes(bytes));
        return null;
    }));
    instructions.push(new Instruction("LBU", ilsSubtype, ["opcode"], [0x24], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 1);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], bytes[0]);
        return null;
    }));
    instructions.push(new Instruction("LHU", ilsSubtype, ["opcode"], [0x25], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 2);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.catBytes(bytes));
        return null;
    }));
    instructions.push(new Instruction("SB", ilsSubtype, ["opcode"], [0x28], function (core) {
        let bytes = [];
        bytes.push(core.registerFile.read(core.arguments[0]) & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            return null;
        }
        return "Illegal memory access.";
    }));
    instructions.push(new Instruction("SH", ilsSubtype, ["opcode"], [0x29], function (core) {
        let bytes = [];
        let value = core.registerFile.read(core.arguments[0]);
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            return null;
        }
        return "Illegal memory access.";
    }));
    instructions.push(new Instruction("SW", ilsSubtype, ["opcode"], [0x2B], function (core) {
        let bytes = [];
        let value = core.registerFile.read(core.arguments[0]);
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            return null;
        }
        return "Illegal memory access.";
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("imm", 0, 26).parameterized(0, Parameter.special)
    ], /[A-z]+\s*([A-Za-z0-9_]+)/, "@mnem @arg0", function (text, type, bits, address, assembler) {
        let array = text.split("");
        let result = {
            errorMessage: null,
            context: null,
            value: null
        };
        let value = null;
        let reference = assembler.linesByLabel[text];
        if (reference !== undefined) {
            result.context = reference[0];
            if (reference[1] === null) {
                return result;
            }
            value = reference[1];
        }
        if (value === null && assembler.keywordRegexes[Keyword.char]) {
            let extraction = assembler.keywordRegexes[Keyword.char].exec(text);
            if (extraction !== null && extraction[1] !== undefined) {
                value = extraction[1].charCodeAt(0);
                if (value > 255) {
                    result.errorMessage = "Non-ascii character " + extraction[1] + " unsupported.";
                    return result;
                }
            }
        }
        if (value === null && assembler.keywordRegexes[Keyword.numeric] !== undefined) {
            let array = assembler.keywordRegexes[Keyword.numeric].exec(text);
            if (array !== null) {
                let radix = Assembler.radixes[array[2]] || 10;
                let interpretable = array[1];
                value = parseInt(interpretable, radix);
            }
        }
        if (value === null || isNaN(value)) {
            result.errorMessage = `args.valueUnrecognized(${text})`;
            return result;
        }
        if ((value >>> 28) == (address >>> 28)) {
            if ((value & 3) == 0) {
                result.value = (value & 0x0ffffffc) >>> 2;
            }
            else {
                result.errorMessage = `mips.wordUnlignedJump(${text})`;
            }
        }
        else {
            result.errorMessage = `args.outOfRange(${text})`;
        }
        return result;
    }, function (value, address) {
        return (value << 2) | (address & 0xf0000000);
    }));
    let jType = formats[formats.length - 1];
    instructions.push(new Instruction("J", jType, ["opcode"], [0x2], function (core) {
        core.pc = core.arguments[0];
        return null;
    }));
    instructions.push(new Instruction("JAL", jType, ["opcode"], [0x3], function (core) {
        core.registerFile.write(31, core.pc);
        core.pc = core.arguments[0];
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5).parameterized(1, Parameter.register),
        new BitRange("rt", 16, 5, 0),
        new BitRange("rd", 11, 5).parameterized(0, Parameter.register),
        new BitRange("shamt", 6, 5, 0),
        new BitRange("funct", 0, 6)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(\$[A-Za-z0-9]+)/, "@mnem @arg0, @arg1"));
    let mvPseudo = formats[formats.length - 1];
    instructions.push(new Instruction("MV", mvPseudo, ["opcode", "funct"], [0x0, 0x20], function (core) {
        return null;
    }));
    formats.push(new Format([
        new BitRange("opcode", 26, 6),
        new BitRange("rs", 21, 5, 0),
        new BitRange("rt", 16, 5).parameterized(0, Parameter.register),
        new BitRange("imm", 0, 16, null, true).parameterized(1, Parameter.immediate)
    ], /[a-zA-Z]+\s*(\$[A-Za-z0-9]+)\s*,\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1"));
    let liPseudo = formats[formats.length - 1];
    instructions.push(new Instruction("LI", liPseudo, ["opcode"], [0x8], function (core) {
        return null;
    }));
    instructions.push(new Instruction("LA", liPseudo, ["opcode"], [0x8], function (core) {
        return null;
    }));
    let process = function (address, text, type, bits, labels, addresses) {
        let array = text.split("");
        let result = {
            errorMessage: null,
            value: null
        };
        switch (type) {
            case Parameter.register:
                let registerNo;
                let index = this.abiNames.indexOf(text);
                if (index !== -1) {
                    result.value = index;
                    return result;
                }
                if (array[0] !== "$") {
                    result.errorMessage = "Register " + text + " does not exist.";
                    return result;
                }
                registerNo = parseInt(array.splice(1, array.length - 1).join(""));
                if (0 <= registerNo && registerNo <= 31) {
                    result.value = registerNo;
                    return result;
                }
                else {
                    result.errorMessage = "Register " + text + " does not exist.";
                    return result;
                }
            case Parameter.immediate:
                var int = NaN;
                let labelIndex = labels.indexOf(text);
                if (labelIndex !== -1) {
                    int = addresses[labelIndex];
                }
                else if (array.length === 3 && (array[0] == "\'") && (array[2] == "\'")) {
                    int = array[1].charCodeAt(0);
                }
                else {
                    let radix = 10 >>> 0;
                    let splice = false;
                    if (array[0] === "0") {
                        if (array[1] == "b") {
                            radix = 2;
                            splice = true;
                        }
                        if (array[1] == "o") {
                            radix = 8;
                            splice = true;
                        }
                        if (array[1] == "d") {
                            radix = 10;
                            splice = true;
                        }
                        if (array[1] == "x") {
                            radix = 16;
                            splice = true;
                        }
                    }
                    let interpretable = text;
                    if (splice) {
                        interpretable = array.splice(2, array.length - 2).join("");
                    }
                    int = parseInt(interpretable, radix);
                }
                if (isNaN(int)) {
                    result.errorMessage = "Immediate '" + text + "' is not a recognized label, literal or character.";
                    return result;
                }
                if (Utils.rangeCheck(int, bits)) {
                    result.value = int;
                    return result;
                }
                result.errorMessage = "The value of '" + text + "' is out of range.";
                return result;
            case Parameter.offset:
                var int = NaN;
                let labelLocation = labels.indexOf(text);
                if (labelLocation !== -1) {
                    int = addresses[labelLocation] - address;
                }
                else {
                    let radix = 10 >>> 0;
                    let splice = false;
                    if (array[0] === "0") {
                        if (array[1] == "b") {
                            radix = 2;
                            splice = true;
                        }
                        if (array[1] == "o") {
                            radix = 8;
                            splice = true;
                        }
                        if (array[1] == "d") {
                            radix = 10;
                            splice = true;
                        }
                        if (array[1] == "x") {
                            radix = 16;
                            splice = true;
                        }
                    }
                    let interpretable = text;
                    if (splice) {
                        interpretable = array.splice(2, array.length - 2).join("");
                    }
                    int = parseInt(interpretable, radix);
                }
                if (isNaN(int)) {
                    result.errorMessage = "Offset '" + text + "' is not a recognized label or literal.";
                    return result;
                }
                if (Utils.rangeCheck(int, bits)) {
                    result.value = int;
                    return result;
                }
                result.errorMessage = "The value of '" + text + "' is out of range.";
                return result;
            default:
                return result;
        }
    };
    let keywords = [];
    keywords[Keyword.directive] = ["\\."];
    keywords[Keyword.comment] = ["#"];
    keywords[Keyword.label] = ["\\:"];
    keywords[Keyword.stringMarker] = ["\\\""];
    keywords[Keyword.charMarker] = ["\\\'"];
    keywords[Keyword.register] = ["x"];
    let directives = [];
    directives["text"] = Directive.text;
    directives["data"] = Directive.data;
    directives["asciiz"] = Directive.cString;
    directives["byte"] = Directive._8bit;
    directives["half"] = Directive._16bit;
    directives["word"] = Directive._32bit;
    let abiNames = ["$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3", "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7", "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7", "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"];
    return new InstructionSet("mips", 32, formats, instructions, pseudoInstructions, abiNames, keywords, directives, "    la $a0, str\n    li $v0, 4 #4 is the string print service number...\n    syscall\n    li $v0, 10 #...and 10 is the program termination service number!\n    syscall\n.data\nstr:\    .asciiz \"Hello, World!\"");
}
class MIPSRegisterFile {
    print() {
        console.log("Registers\n------");
        for (let i = 0; i < 32; i++) {
            console.log("$" + i.toString(), this.abiNames[i], this.physicalFile[i].toString(), (this.physicalFile[i] >>> 0).toString(16).toUpperCase());
        }
        console.log("------");
    }
    read(registerNumber) {
        if (registerNumber === 0) {
            return 0;
        }
        else {
            return this.physicalFile[registerNumber];
        }
    }
    write(registerNumber, value) {
        this.physicalFile[registerNumber] = value;
        this.modifiedRegisters[registerNumber] = true;
    }
    getRegisterCount() {
        return 32;
    }
    getModifiedRegisters() {
        let modReg = this.modifiedRegisters.slice();
        for (let i = 0; i < this.getRegisterCount(); i++) {
            this.modifiedRegisters[i] = false;
        }
        return modReg;
    }
    reset() {
        for (let i = 0; i < 32; i++) {
            this.physicalFile[i] = 0;
            this.modifiedRegisters[i] = false;
        }
        this.physicalFile[29] = this.memorySize;
    }
    constructor(memorySize, abiNames) {
        this.physicalFile = [];
        this.modifiedRegisters = [];
        for (let i = 0; i < 32; i++) {
            this.physicalFile.push(0);
            this.modifiedRegisters.push(false);
        }
        this.memorySize = memorySize;
        this.physicalFile[29] = memorySize;
        this.abiNames = abiNames;
    }
}
;
class MIPSCore extends Core {
    reset() {
        this.pc = 0;
        this.memory = [];
        for (let i = 0; i < this.memorySize; i++) {
            this.memory[i] = 0;
        }
        this.registerFile.reset();
    }
    fetch() {
        let arr = this.memcpy(this.pc, 4);
        if (arr == null) {
            return "fetch.illegalMemoryAddress";
        }
        this.pc += 4;
        this.fetched = Utils.catBytes(arr);
        return null;
    }
    constructor(memorySize, virtualOS, instructionSet) {
        super();
        this.virtualOSServiceRegister = 2;
        this.virtualOSArgumentVectorStart = 4;
        this.virtualOSArgumentVectorEnd = 7;
        this.instructionSet = instructionSet;
        this.pc = 0 >>> 0;
        this.memorySize = memorySize;
        this.virtualOS = virtualOS;
        this.registerFile = new MIPSRegisterFile(memorySize, instructionSet.abiNames);
        this.memory = new Array(memorySize);
        for (let i = 0; i < memorySize; i++) {
            this.memory[i] = 0;
        }
    }
}
function RISCV(options) {
    let formats = [];
    let instructions = [];
    let pseudoInstructions = [];
    formats.push(new Format([
        new BitRange("funct7", 25, 7),
        new BitRange("rs2", 20, 5).parameterized(2, Parameter.register),
        new BitRange("rs1", 15, 5).parameterized(1, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)/, "@mnem @arg0, @arg1, @arg2"));
    let rType = formats[formats.length - 1];
    instructions.push(new Instruction("ADD", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b000, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SUB", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b000, 0b0100000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) - core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SLL", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b001, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) << core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SLT", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b010, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) < core.registerFile.read(core.arguments[2])) ? 1 : 0);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SLTU", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b011, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], ((core.registerFile.read(core.arguments[1]) >>> 0) < (core.registerFile.read(core.arguments[2]) >>> 0)) ? 1 : 0);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("XOR", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b100, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) ^ core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SRL", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b101, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >>> core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SRA", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b101, 0b0100000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >> core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("OR", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b110, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) | core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("AND", rType, ["opcode", "funct3", "funct7"], [0b0110011, 0b111, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) & core.registerFile.read(core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    formats.push(new Format([
        new BitRange("imm", 20, 12, null, true).parameterized(2, Parameter.immediate),
        new BitRange("rs1", 15, 5).parameterized(1, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+),\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1, @arg2"));
    let iType = formats[formats.length - 1];
    instructions.push(new Instruction("JALR", iType, ["opcode", "funct3"], [0b1100111, 0b000], function (core) {
        core.registerFile.write(core.arguments[0], core.pc + 4);
        core.pc = (core.registerFile.read(core.arguments[1]) + Utils.signExt(core.arguments[2], 12));
        return null;
    }));
    instructions.push(new Instruction("ADDI", iType, ["opcode", "funct3"], [0b0010011, 0b000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) + core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SLTI", iType, ["opcode", "funct3"], [0b0010011, 0b010], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) < core.arguments[2]) ? 1 : 0);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SLTIU", iType, ["opcode", "funct3"], [0b0010011, 0b011], function (core) {
        core.registerFile.write(core.arguments[0], ((core.registerFile.read(core.arguments[1]) >>> 0) < (core.arguments[2] >>> 0) ? 1 : 0));
        core.pc += 4;
        return null;
    }, false));
    instructions.push(new Instruction("XORI", iType, ["opcode", "funct3"], [0b0010011, 0b100], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) >>> 0) ^ core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("ORI", iType, ["opcode", "funct3"], [0b0010011, 0b110], function (core) {
        core.registerFile.write(core.arguments[0], (core.registerFile.read(core.arguments[1]) >>> 0) | core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("ANDI", iType, ["opcode", "funct3"], [0b0010011, 0b111], function (core) {
        core.registerFile.write(core.arguments[0], ((core.registerFile.read(core.arguments[1]) >>> 0) & core.arguments[2]));
        core.pc += 4;
        return null;
    }));
    formats.push(new Format([
        new BitRange("imm", 20, 12, null, true).parameterized(1, Parameter.immediate),
        new BitRange("rs1", 15, 5).parameterized(2, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*(-?0?[boxd]?[0-9A-F]+)\s*\(\s*([A-Za-z0-9]+)\s*\)/, "@mnem @arg0, @arg2(@arg1)"));
    let ilSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("LB", ilSubtype, ["opcode", "funct3"], [0b0000011, 0b000], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 1);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.signExt(bytes[0], 8));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("LH", ilSubtype, ["opcode", "funct3"], [0b0000011, 0b001], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 2);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.signExt(Utils.catBytes(bytes), 16));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("LW", ilSubtype, ["opcode", "funct3"], [0b0000011, 0b010], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 4);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.catBytes(bytes));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("LBU", ilSubtype, ["opcode", "funct3"], [0b0000011, 0b100], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 1);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], bytes[0]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("LHU", ilSubtype, ["opcode", "funct3"], [0b0000011, 0b101], function (core) {
        let bytes = core.memcpy(core.registerFile.read(core.arguments[2]) + core.arguments[1], 2);
        if (bytes === null) {
            return "Illegal memory access.";
        }
        core.registerFile.write(core.arguments[0], Utils.catBytes(bytes));
        core.pc += 4;
        return null;
    }));
    formats.push(new Format([
        new BitRange("funct7", 25, 7),
        new BitRange("shamt", 20, 5).parameterized(2, Parameter.immediate),
        new BitRange("rs1", 15, 5).parameterized(1, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+),\s*(-?0?[boxd]?[0-9A-F]+)/, "@mnem @arg0, @arg1, @arg2"));
    let isSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("SLLI", isSubtype, ["opcode", "funct3", "funct7"], [0b0010011, 0b001, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) << core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SRLI", isSubtype, ["opcode", "funct3", "funct7"], [0b0010011, 0b101, 0b0000000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >>> core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("SRAI", isSubtype, ["opcode", "funct3", "funct7"], [0b0010011, 0b101, 0b0100000], function (core) {
        core.registerFile.write(core.arguments[0], core.registerFile.read(core.arguments[1]) >> core.arguments[2]);
        core.pc += 4;
        return null;
    }));
    formats.push(new Format([
        new BitRange("imm", 25, 7, null, true).parameterized(1, Parameter.immediate).limited(12, 5, 11),
        new BitRange("rs2", 20, 5).parameterized(0, Parameter.register),
        new BitRange("rs1", 15, 5).parameterized(2, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("imm", 7, 5, null, true).parameterized(1, Parameter.immediate).limited(12, 0, 4),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*(-?0?[boxd]?[0-9A-F]+)\(\s*([A-Za-z0-9]+)\s*\)/, "@mnem @arg0, @arg2(@arg1)"));
    let sType = formats[formats.length - 1];
    instructions.push(new Instruction("SB", sType, ["opcode", "funct3"], [0b0100011, 0b000], function (core) {
        let bytes = [];
        bytes.push(core.registerFile.read(core.arguments[0]) & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            core.pc += 4;
            return null;
        }
        return "Illegal memory access.";
    }));
    instructions.push(new Instruction("SH", sType, ["opcode", "funct3"], [0b0100011, 0b001], function (core) {
        let bytes = [];
        let value = core.registerFile.read(core.arguments[0]);
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            core.pc += 4;
            return null;
        }
        return "Illegal memory access.";
    }));
    instructions.push(new Instruction("SW", sType, ["opcode", "funct3"], [0b0100011, 0b010], function (core) {
        let bytes = [];
        let value = core.registerFile.read(core.arguments[0]);
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        value = value >>> 8;
        bytes.push(value & 255);
        if (core.memset(core.registerFile.read(core.arguments[2]) + core.arguments[1], bytes)) {
            core.pc += 4;
            return null;
        }
        return "Illegal memory access.";
    }));
    formats.push(new Format([
        new BitRange("imm", 12, 20, null, true).parameterized(1, Parameter.immediate),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.offset),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1"));
    let uType = formats[formats.length - 1];
    instructions.push(new Instruction("LUI", uType, ["opcode"], [0b0110111], function (core) {
        core.registerFile.write(core.arguments[0], (core.arguments[1] << 12));
        core.pc += 4;
        return null;
    }));
    instructions.push(new Instruction("AUIPC", uType, ["opcode"], [0b0010111], function (core) {
        core.registerFile.write(core.arguments[0], (core.arguments[1] << 12) + core.pc);
        core.pc += 4;
        return null;
    }));
    formats.push(new Format([
        new BitRange("imm", 31, 1, null, true).parameterized(2, Parameter.offset).limited(13, 12, 12),
        new BitRange("imm", 25, 6, null, true).parameterized(2, Parameter.offset).limited(13, 5, 10),
        new BitRange("rs2", 20, 5).parameterized(1, Parameter.register),
        new BitRange("rs1", 15, 5).parameterized(0, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("imm", 8, 4, null, true).parameterized(2, Parameter.offset).limited(13, 1, 4),
        new BitRange("imm", 7, 1, null, true).parameterized(2, Parameter.offset).limited(13, 11, 11),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)\s*,\s*([a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1, @arg2"));
    let sbType = formats[formats.length - 1];
    instructions.push(new Instruction("BEQ", sbType, ["opcode", "funct3"], [0b1100011, 0b000], function (core) {
        if (core.registerFile.read(core.arguments[0]) === core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    instructions.push(new Instruction("BNE", sbType, ["opcode", "funct3"], [0b1100011, 0b001], function (core) {
        if (core.registerFile.read(core.arguments[0]) !== core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    instructions.push(new Instruction("BLT", sbType, ["opcode", "funct3"], [0b1100011, 0b100], function (core) {
        if (core.registerFile.read(core.arguments[0]) < core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    instructions.push(new Instruction("BGE", sbType, ["opcode", "funct3"], [0b1100011, 0b101], function (core) {
        if (core.registerFile.read(core.arguments[0]) >= core.registerFile.read(core.arguments[1])) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    instructions.push(new Instruction("BLTU", sbType, ["opcode", "funct3"], [0b1100011, 0b110], function (core) {
        if ((core.registerFile.read(core.arguments[0]) >>> 0) < (core.registerFile.read(core.arguments[1]) >>> 0)) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    instructions.push(new Instruction("BGEU", sbType, ["opcode", "funct3"], [0b1100011, 0b111], function (core) {
        if ((core.registerFile.read(core.arguments[0]) >>> 0) >= (core.registerFile.read(core.arguments[1]) >>> 0)) {
            core.pc += core.arguments[2];
        }
        else {
            core.pc += 4;
        }
        return null;
    }));
    formats.push(new Format([
        new BitRange("imm", 31, 1, null, true).parameterized(1, Parameter.offset).limited(21, 20, 20),
        new BitRange("imm", 21, 10, null, true).parameterized(1, Parameter.offset).limited(21, 1, 10),
        new BitRange("imm", 20, 1, null, true).parameterized(1, Parameter.offset).limited(21, 11, 11),
        new BitRange("imm", 12, 8, null, true).parameterized(1, Parameter.offset).limited(21, 12, 19),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1"));
    let ujType = formats[formats.length - 1];
    instructions.push(new Instruction("JAL", ujType, ["opcode"], [0b1101111], function (core) {
        core.registerFile.write(core.arguments[0], core.pc + 4);
        core.pc += Utils.signExt(core.arguments[1], 21);
        return null;
    }));
    formats.push(new Format([
        new BitRange("const", 0, 32)
    ], /([a-zA-Z]+)/, "@mnem"));
    let allConstSubtype = formats[formats.length - 1];
    instructions.push(new Instruction("ECALL", allConstSubtype, ["const"], [0b00000000000000000000000001110011], (core) => {
        let result = core.virtualOS.ecall(core);
        core.pc += 4;
        return result;
    }));
    formats.push(new Format([
        new BitRange("funct7", 25, 7),
        new BitRange("rs2", 20, 5).parameterized(1, Parameter.register),
        new BitRange("rs1", 15, 5),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)/, "@mnem @arg0, @arg1"));
    let mvPseudo = formats[formats.length - 1];
    instructions.push(new Instruction("MV", mvPseudo, ["opcode", "funct3", "rs1", "funct7"], [0b0110011, 0b000, parseInt("00000"), 0b0000000], function (core) {
        return null;
    }, false, ["ADD"]));
    formats.push(new Format([
        new BitRange("imm", 20, 12, null, true).parameterized(1, Parameter.immediate),
        new BitRange("rs1", 15, 5),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5).parameterized(0, Parameter.register),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)\s*,\s*(-?[a-zA-Z0-9_]+)/, "@mnem @arg0, @arg1"));
    let liPseudo = formats[formats.length - 1];
    instructions.push(new Instruction("LI", liPseudo, ["opcode", "funct3", "rs1"], [0b0010011, 0b000, 0b00000], function (core) {
        return null;
    }, false, ["ADDI"]));
    instructions.push(new Instruction("LA", liPseudo, ["opcode", "funct3", "rs1"], [0b0010011, 0b000, 0b00000], function (core) {
        return null;
    }, false, ["ADDI"]));
    formats.push(new Format([
        new BitRange("imm", 20, 12, null, true),
        new BitRange("rs1", 15, 5).parameterized(0, Parameter.register),
        new BitRange("funct3", 12, 3),
        new BitRange("rd", 7, 5),
        new BitRange("opcode", 0, 7)
    ], /([a-zA-Z]+)\s*([A-Za-z0-9]+)/, "@mnem @arg0"));
    let jrPseudo = formats[formats.length - 1];
    instructions.push(new Instruction("JR", jrPseudo, ["opcode", "rd", "funct3", "imm"], [0b1100111, 0b00000, 0b000, 0b000000000000], function (core) {
        return null;
    }, false, ["ADDI"]));
    instructions.push(new Instruction("SCALL", allConstSubtype, ["const"], [0b00000000000000000000000001110011], function (core) {
        return null;
    }, false, ["ECALL"]));
    instructions.push(new Instruction("SYSCALL", allConstSubtype, ["const"], [0b00000000000000000000000001110011], function (core) {
        return null;
    }, false, ["ECALL"]));
    let abiNames = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];
    let keywords = [];
    keywords[Keyword.directive] = ["\\."];
    keywords[Keyword.comment] = ["#"];
    keywords[Keyword.label] = ["\\:"];
    keywords[Keyword.stringMarker] = ["\\\""];
    keywords[Keyword.charMarker] = ["\\\'"];
    keywords[Keyword.register] = ["x"];
    let directives = [];
    directives["text"] = Directive.text;
    directives["data"] = Directive.data;
    directives["string"] = Directive.cString;
    directives["byte"] = Directive._8bit;
    directives["half"] = Directive._16bit;
    directives["word"] = Directive._32bit;
    return new InstructionSet("riscv", 32, formats, instructions, pseudoInstructions, abiNames, keywords, directives, "    la a0, str\n    li a7, 4 #4 is the string print service number...\n    ecall\n    li a7, 10 #...and 10 is the program termination service number!\n    ecall\n.data\nstr:\    .string \"Hello, World!\"");
}
class RISCVRegisterFile {
    print() {
        console.log("Registers\n------");
        for (let i = 0; i < 32; i++) {
            console.log("x" + i.toString(), this.abiNames[i], this.physicalFile[i].toString(), (this.physicalFile[i] >>> 0).toString(16).toUpperCase());
        }
        console.log("------");
    }
    read(registerNumber) {
        if (registerNumber === 0) {
            return 0;
        }
        else {
            return this.physicalFile[registerNumber];
        }
    }
    write(registerNumber, value) {
        this.physicalFile[registerNumber] = value;
        this.modifiedRegisters[registerNumber] = true;
    }
    getRegisterCount() {
        return 32;
    }
    getModifiedRegisters() {
        let modReg = this.modifiedRegisters.slice();
        for (let i = 0; i < this.getRegisterCount(); i++) {
            this.modifiedRegisters[i] = false;
        }
        return modReg;
    }
    reset() {
        for (let i = 0; i < 32; i++) {
            this.physicalFile[i] = 0;
            this.modifiedRegisters[i] = false;
        }
        this.physicalFile[2] = this.memorySize;
    }
    constructor(memorySize, abiNames) {
        this.physicalFile = [];
        this.modifiedRegisters = [];
        for (let i = 0; i < 32; i++) {
            this.physicalFile.push(0);
            this.modifiedRegisters.push(false);
        }
        this.memorySize = memorySize;
        this.physicalFile[2] = memorySize;
        this.abiNames = abiNames;
    }
}
;
class RISCVCore extends Core {
    reset() {
        this.pc = 0;
        this.memory = [];
        for (let i = 0; i < this.memorySize; i++) {
            this.memory[i] = 0;
        }
        this.registerFile.reset();
    }
    fetch() {
        if (this.pc < 0) {
            return "fetch.negativePC";
        }
        let arr = this.memcpy(this.pc, 4);
        if (arr == null) {
            return "fetch.invalidMemoryAccess";
        }
        this.fetched = Utils.catBytes(arr);
        return null;
    }
    constructor(memorySize, virtualOS, instructionSet) {
        super();
        this.virtualOSServiceRegister = 10;
        this.virtualOSArgumentVectorStart = 11;
        this.virtualOSArgumentVectorEnd = 17;
        this.pc = 0 >>> 0;
        this.memorySize = memorySize;
        this.virtualOS = virtualOS;
        this.instructionSet = instructionSet;
        this.registerFile = new RISCVRegisterFile(memorySize, instructionSet.abiNames);
        this.memory = new Array(memorySize);
        for (let i = 0; i < memorySize; i++) {
            this.memory[i] = 0;
        }
    }
}
class CoreFactory {
    static getCore(architecture, memorySize, virtualOS, options) {
        let isa = this.ISAs[architecture];
        if (isa === undefined) {
            return null;
        }
        for (let key in options) {
            if (!isa.options.include(key)) {
                return null;
            }
        }
        let instructionSet = isa.generator(options);
        console.log(virtualOS);
        return new isa.core(memorySize, virtualOS, instructionSet);
    }
}
CoreFactory.ISAs = {
    "RISC-V": {
        generator: RISCV,
        core: RISCVCore,
        options: ["C", "M", "D"]
    },
    "MIPS": {
        generator: MIPS,
        core: MIPSCore,
        options: []
    }
};
let args = process.argv.slice(2);
console.log("Oak.js · 2.0-dev");
console.log("All rights reserved.");
console.log("You should have obtained a copy of the Mozilla Public License with your app.");
console.log("If you did not, a verbatim copy should be available at https://www.mozilla.org/en-US/MPL/2.0/.");
let Filesystem = require('fs');
let Prompt = require('prompt-sync')();
let isa = "RISC-V";
let cliVirtualOS = new VirtualOS();
cliVirtualOS.outputInt = (number) => {
    console.log(number);
};
cliVirtualOS.outputString = (string) => {
    console.log(string);
};
let cpu = CoreFactory.getCore(isa, 2048, cliVirtualOS, []);
let file = Filesystem.readFileSync(args[0]).toString();
let assembler = new Assembler(cpu.instructionSet, Endianness.little);
let lines = Line.arrayFromFile(file);
let passZero = assembler.assemble(lines, 0);
if (passZero.length !== 0) {
    for (let i in passZero) {
        let line = passZero[i];
        console.log(line.number, line.invalidReason);
        process.exit(65);
    }
}
let pass = null;
let passCounter = 1;
do {
    pass = assembler.assemble(lines, passCounter);
    if (pass.length !== 0) {
        for (let i in passZero) {
            let line = passZero[i];
            console.log(line.number, line.invalidReason);
            process.exit(65);
        }
    }
    passCounter += 1;
} while (pass === null);
let machineCode = lines.map(line => line.machineCode).reduce((a, b) => a.concat(b), []);
cpu.memset(0, machineCode);
running: while (true) {
    let fetch = cpu.fetch();
    if (fetch !== null) {
        console.log(fetch);
        break running;
    }
    let decode = cpu.decode();
    if (decode === null) {
        console.log("decode.failure");
        break running;
    }
    console.log(decode);
    let execute = cpu.execute();
    if (execute !== null) {
        if (execute !== 'HALT') {
            console.log(execute);
        }
        break running;
    }
}
process.exit(0);
