import { ClassExp, ProcExp, Exp, Program, makeClassExp, makeIfExp, IfExp, VarDecl, Binding, makeVarDecl, makeProcExp,CExp, makePrimOp, makeAppExp, makeVarRef, makeLitExp } from "./L3-ast";
import { Result, makeFailure } from "../shared/result";
import { cond } from "ramda";
import { makeSymbolSExp } from "./L3-value";

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp =>{
       //@TODO
// need to transform to lamda, given a msg activate the method
// need to scan for params
// need to scan for methods - build an ifexp for each method
// type ClassExp ={tag: "ClassExp"; fields: VarDecl[]; methods: Binding[]; } // class in L3, 2a
// type ProcExp = {tag: "ProcExp"; args: VarDecl[], body: CExp[]; } // lamda

const fields = exp.fields;
    const methods = exp.methods;
    const msgD = makeVarDecl("msg"); //declere a variable for the message
const msgR = makeVarRef("msg");

    const body=methods.reduceRight((acc:CExp,m:Binding)=>{
        const condition=makeAppExp(makePrimOp("eq?"),[
            msgR,
            makeLitExp(makeSymbolSExp(m.var.var))]); // (eq? msg "methodName")
        const methodBodyArray = (m.val as ProcExp).body;
            const then=(m.val as ProcExp).body.slice(-1)[0];  // the method body
        const alt=acc; // the next method or the error if no more methods
        
        return makeIfExp(condition,then,alt);
    },makeLitExp(makeSymbolSExp("error")));

    const innerLamda=makeProcExp([msg],[body]);
    const biglamda= makeProcExp(fields,[innerLamda]);
    return biglamda;
}
 
  
/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/

export const transform = (exp: Exp | Program): Result<Exp | Program> =>
    //@TODO
    makeFailure("ToDo");
function acc(previousValue: Binding, currentValue: Binding, currentIndex: number, array: Binding[]): Binding {
    throw new Error("Function not implemented.");
}

function makeEqExp(var: never, msg: never): import("./L3-ast").CExp {
    throw new Error("Function not implemented.");
}

