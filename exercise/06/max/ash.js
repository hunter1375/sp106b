var fs = require("fs");
var c  = console;
var file = process.argv[2];

var dtable = {
  ""   :0b000,
  "M"  :0b001,
  "D"  :0b010,
  "MD" :0b011,
  "A"  :0b100,
  "AM" :0b101,
  "AD" :0b110,
  "AMD":0b111
}

var jtable = {
  ""   :0b000,
  "JGT":0b001,
  "JEQ":0b010,
  "JGE":0b011,
  "JLT":0b100,
  "JNE":0b101,
  "JLE":0b110,
  "JMP":0b111
}

var ctable = {
  "0"   :0b0101010,
  "1"   :0b0111111,
  "-1"  :0b0111010,
  "D"   :0b0001100,
  "A"   :0b0110000, 
  "M"   :0b1110000,
  "!D"  :0b0001101,
  "!A"  :0b0110001, 
  "!M"  :0b1110001,
  "-D"  :0b0001111,
  "-A"  :0b0110011,
  "-M"  :0b1110011,
  "D+1" :0b0011111,
  "A+1" :0b0110111,
  "M+1" :0b1110111,
  "D-1" :0b0001110,
  "A-1" :0b0110010,
  "M-1" :0b1110010,
  "D+A" :0b0000010,
  "D+M" :0b1000010,
  "D-A" :0b0010011,
  "D-M" :0b1010011,
  "A-D" :0b0000111,
  "M-D" :0b1000111,
  "D&A" :0b0000000,
  "D&M" :0b1000000,
  "D|A" :0b0010101,
  "D|M" :0b1010101
}

var symTable = {
  "R0"  :0,
  "R1"  :1,
  "R2"  :2,
  "R3"  :3,
  "R4"  :4,
  "R5"  :5,
  "R6"  :6,
  "R7"  :7,
  "R8"  :8,
  "R9"  :9,
  "R10" :10,
  "R11" :11,
  "R12" :12,
  "R13" :13,
  "R14" :14,
  "R15" :15,
  "SP"  :0,
  "LCL" :1,
  "ARG" :2,
  "THIS":3, 
  "THAT":4,
  "KBD" :24576,
  "SCREEN":16384
};

var symTop = 16;

function addSymbol(symbol) {
  symTable[symbol] = symTop;
  symTop ++;
}

assemble(file+'.asm', file+'.hack');

function assemble(asmFile, objFile) {
  var asmText = fs.readFileSync(asmFile, "utf8"); // 讀取檔案到 text 字串中
  var lines   = asmText.split(/\r?\n/); // 將組合語言分割成一行一行 .split()：分割split內的內容
                                        // \r 比對 carriage return	
                                        // \n 比對換行符號	
  c.log(JSON.stringify(lines, null, 2)); 
  pass1(lines);
  pass2(lines, objFile);
} 

function parse(line, i) {
  line.match(/^([^\/]*)(\/.*)?$/); // ^([^\/]*)比對//前的字串並存入RegExp.$1
                                   // (\/.*)?$ 比對//後的字串並存入RegExp.$2
  line = RegExp.$1.trim(); // trim省略空格
  if (line.length===0)
    return null;   
  if (line.startsWith("@")) { // 對比開頭為＠的字串
    return { type:"A", arg:line.substring(1).trim() } //回傳type:A 回傳字串
  } else if (line.match(/^\(([^\)]+)\)$/)) { // 對比開頭結尾為()的字串 [^\)] 不能用\w 因考慮到可能會有.$等特殊字元
    return { type:"S", symbol:RegExp.$1 } //回傳type:S 回傳字串
  } else if (line.match(/^((([AMD]*)=)?([AMD01\+\-\&\|\!]*))(;(\w*))?$/)) { //RegExp:$1 :((([AMD]*)=)?([AMD01\+\-\&\|\!]*)) 
                                                                            //RegExp:$2 :(([AMD]*)=)? 比對有無＝號
                                                                            //RegExp:$3 :([AMD]*) 比對AMD １次或多次 =dtable
                                                                            //RegExp:$4 :([AMD01\+\-\&\|\!]*) 比對=號後的內容 = ctable
                                                                            //RegExp:$5 :(\w*) 比對跳躍符號內容 = jtable
                                                                            //RegExp:$6 :(;(\w*)) 比對有無;跳躍符號
    return { type:"C", c:RegExp.$4, d:RegExp.$3, j:RegExp.$6 } // 回傳指令是C, 將經過正規表達式比對的變數放入相應的表格
  } else {
    throw "Error: line "+(i+1); //回傳錯誤 +下一行
  }
}

function pass1(lines) {
  c.log("============== pass1 ================");
  var address = 0;
  for (var i=0; i<lines.length; i++) {
    var p = parse(lines[i], i);
    if (p===null) continue; //如果字串不是ASC這三種類型就跳過=i+1
    if (p.type === "S") {
      c.log(" symbol: %s %s", p.symbol, intToStr(address, 4, 10));
      symTable[p.symbol] = address;
      continue;
    } else {
      c.log(" p: %j", p); //
    }
    c.log("%s:%s %s", intToStr(i+1, 3, 10), intToStr(address, 4, 10),  lines[i]);
    address++;
  }
}

function pass2(lines, objFile) {
  c.log("============== pass2 ================");
  var ws = fs.createWriteStream(objFile); // 將目標檔寫進字串
  ws.once('open', function(fd) {
    var address = 0;
    for (var i=0; i<lines.length; i++) {
      var p = parse(lines[i], i);
      if (p===null || p.type === "S") continue;
      var code = toCode(p);
      c.log("%s:%s %s", intToStr(i+1, 3, 10), intToStr(code, 16, 2),  lines[i]);
      ws.write(intToStr(code, 16, 2)+"\n");
      address++;
    }
    ws.end();
  });
}

function intToStr(num, size, radix) { //轉成字串 num＝數字 size＝長度 radix=進位
  // c.log(" num="+num);
  var s = num.toString(radix)+"";
  while (s.length < size) s = "0" + s; // 若字串長度小於size，自動補0
  return s;
}

function toCode(p) {
  var address; 
  if (p.type === "A") {  // 如果為A指令
    if (p.arg.match(/^\d+$/)) { // 比對有無數字
      address = parseInt(p.arg); // 轉換成整數
    } else { //否則
      address = symTable[p.arg]; // 從符號表裡面找到對應的放進去
      if (typeof address === 'undefined') { // 如果符號表裡沒有
        address = symTop; // 設成新的符號
        addSymbol(p.arg, address); // 紀錄該指令位置
      }
    }
    return address; 
  } else { // if (p.type === "C")
    var d = dtable[p.d];
    var cx = ctable[p.c];
    var j = jtable[p.j];
    return 0b111<<13|cx<<6|d<<3|j;
  }
}