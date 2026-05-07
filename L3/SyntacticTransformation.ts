import { ClassExp, ProcExp, Exp, Program, makeClassExp, makeIfExp, IfExp, VarDecl, Binding } from "./L3-ast";
import { Result, makeFailure } from "../shared/result";

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp =>
    //@TODO


map(exp.methods, (m:Binding) => m.var.var==msg? makeIfExp( makeEqExp(m.var.var, msg), m.val, makeFailure("Method not found"));

);

const condition=(name:string):IfExp=>{
    return ;
}

    exp;


/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/

export const transform = (exp: Exp | Program): Result<Exp | Program> =>
    //@TODO
    makeFailure("ToDo");
