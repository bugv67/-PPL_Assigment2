import { ClassExp, ProcExp, Exp, Program, makeClassExp, makeProcExp, makeVarDecl, CExp, makeVarRef, makeIfExp, makeAppExp, makePrimOp, makeLitExp, isClassExp, isVarDecl, isAtomicExp, isCompoundExp, isAppExp, isIfExp, isProcExp, VarDecl, isLetExp, Binding, makeBinding, makeLetExp, isLitExp, isDefineExp, makeDefineExp, isProgram } from "./L3-ast";
import { Result, bind, makeFailure, makeOk, mapResult } from "../shared/result";
import { makeSymbolSExp } from "./L3-value";

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp => {

    // create the message variable
    const msgParam = makeVarDecl("msg");
    const msgRef = makeVarRef("msg");

    // for each method, create an entry of the form {name: methodName, value: methodLambda}
   const methodDictionary = exp.methods.map(method => ({
    name: method.var.var,
    // Cast method.val to ProcExp so we can access its body
    value: (method.val as ProcExp).body[0] 
    // last line - value: (method.val as ProcExp).body.at(-1)!
}));

    // for each case create an if statement that checks if the message is the name of the method,
    // and if so returns the body of the method 
    const ifStatements = methodDictionary.reduceRight<CExp>(
        (acc: CExp, entry): CExp =>
            makeIfExp(
                makeAppExp(makePrimOp("eq?"), [
                    msgRef,
                    makeLitExp(makeSymbolSExp(entry.name))
                ]),
                entry.value,
                acc
            ),
        makeLitExp(makeSymbolSExp("error"))
    );

    const innerlambda = makeProcExp([msgParam], [ifStatements]);

    return makeProcExp(exp.fields, [innerlambda]);
};


/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/

export const transform = (exp: Exp | Program): Result<Exp | Program> => {
    if (isClassExp(exp)) { // can a class has a class inside it?
        /*if (isClassExp(exp)) {
    return transform(class2proc(exp)); // רקורסיה על ה-ProcExp שנוצר
}  */
        return makeOk(class2proc(exp));
    }

    if (isAtomicExp(exp) || isVarDecl(exp) || isLitExp(exp)) {
        return makeOk(exp);
    }

    if (isAppExp(exp)) {
        // 1. Transform the operator
        const ratorRes = transform(exp.rator) as Result<Exp>;

        // 2. Transform all operands (this creates an array of Results)
        const randsRes = mapResult(transform, exp.rands) as Result<Exp[]>;

        // 3. create a new AppExp with the transformed operator and operands
        // we use bind to create with the result
        return bind(ratorRes, (rator: Exp) =>
            bind(randsRes, (rands: Exp[]) =>
                makeOk(makeAppExp(rator as CExp, rands as CExp[]))
            )
        );
    }

    if (isIfExp(exp)) {
        // if you dont understand, look at app case
        const testRes = transform(exp.test) as Result<Exp>;
        const thenRes = transform(exp.then) as Result<Exp>;
        const altRes = transform(exp.alt) as Result<Exp>;

        return bind(testRes, (test: Exp) =>
            bind(thenRes, (then: Exp) =>
                bind(altRes, (alt: Exp) =>
                    makeOk(makeIfExp(test as CExp, then as CExp, alt as CExp))
                )
            )
        );
    }

    if (isProcExp(exp)) {
        const bodyRes = mapResult(transform, exp.body) as Result<Exp[]>;
        
        return bind(bodyRes, (body: Exp[]) =>
            makeOk(makeProcExp(exp.args, body as CExp[]))
        );
    }

    if (isLetExp(exp)) {
        // bindings needs to be transformed
        // to tranform each binding, transfrom the val of the binding
        const bindingsRes = mapResult(
            (b: Binding) =>
                bind(transform(b.val), (transformedVal: Exp | Program) =>
                    // casting the transformedVal into Cexp
                    makeOk(makeBinding(b.var.var, transformedVal as CExp))
                ),
            exp.bindings
        );

        // transform the body of the let
        // cast the transformed body into Cexp[]
        const bodyRes = mapResult(transform, exp.body) as Result<CExp[]>;

        return bind(bindingsRes, (bindings: Binding[]) =>
            bind(bodyRes, (body: CExp[]) =>
                makeOk(makeLetExp(bindings, body))
            )
        );
    }

    if (isDefineExp(exp)) {
        const valRes = transform(exp.val) as Result<Exp>;
        
        return bind(valRes, (val: Exp) =>
            makeOk(makeDefineExp(exp.var, val as CExp))
        );
    }

    if (isProgram(exp)) {
        const expsRes = mapResult(transform, exp.exps) as Result<Exp[]>;
        
        return bind(expsRes, (exps: Exp[]) =>
            makeOk({ tag: "Program", exps })
        );
    }

    // Default failure case if no tags match
    return makeFailure("Unknown expression");
};