import { ClassExp, ProcExp, Exp, Program, makeClassExp, makeProcExp, makeVarDecl, CExp, makeVarRef, makeIfExp, makeAppExp, makePrimOp, makeLitExp, isClassExp, isVarDecl, isAtomicExp, isCompoundExp, isAppExp, isIfExp, isProcExp, VarDecl, isLetExp, Binding, makeBinding } from "./L3-ast";
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


    // for each field, create an entry of the form {name: fieldName, value: (VarRef fieldName)}
    const fieldDictionary = exp.fields.map(field => ({
        name: field.var,
        value: makeVarRef(field.var)
    }));

    // for each method, create an entry of the form {name: methodName, value: methodLambda}
    const methodDictionary = exp.methods.map(method => ({
        name: method.var.var,
        value: method.val
    }));

    const allDictionaries = [...fieldDictionary, ...methodDictionary];

    // for each case create an if statement that checks if the message is the name of the field/method, and if so returns the corresponding value
    const ifStatements = allDictionaries.reduceRight<CExp>(
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
    if (isClassExp(exp)) {
        return makeOk(class2proc(exp));
    }
    if (isAtomicExp(exp) || isVarDecl(exp)) {
        return makeOk(exp);
    }
    if (isCompoundExp(exp)) {
        if (isClassExp(exp)) {
            return makeOk(class2proc(exp));
        }
        if (isAppExp(exp)) {
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
            const bindings = exp.bindings as Binding[];
            const bindingsRes = mapResult((b: Binding) =>
                bind(transform(b.val), (transformedVal: Exp) =>
                    makeOk(makeBinding(b.var.var, transformedVal as CExp))
                ),
                exp.bindings
            );

            const bodyRes = mapResult(transform, exp.body);

        }


        makeFailure("ToDo");
    }


