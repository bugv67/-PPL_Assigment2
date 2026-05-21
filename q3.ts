import { AtomicExp, BoolExp, Exp, isAppExp, isAtomicExp, isCExp, isCompoundExp, isDefineExp, isExp, isIfExp, isLetExp, isPrimOp, isProcExp, isProgram, isVarRef, NumExp, PrimOp, Program, StrExp, VarRef } from './L3/L3-ast';
import { isSymbolSExp } from './L3/L3-value';
import { Result, bind, makeFailure, makeOk, mapResult, } from './shared/result';
import { isBoolean, isNumber, isString } from './shared/type-predicates';

/*
Purpose: Transform L2 AST to Python program string
Signature: l2ToPython(l2AST)
Type: [Parsed | Error] => Result<string>
*/
export const l2ToPython = (exp: Exp | Program): Result<string> => {
    if (isProgram(exp)) {
        return bind(mapResult(l2ToPython, exp.exps), (exps: string[]) => makeOk(exps.join("\n")));
    }
    if (isExp(exp)) {
        if (isDefineExp(exp)) {
            const varName = exp.var.var;
            const valRes = l2ToPython(exp.val);
            return bind(valRes, (val: string) => makeOk(`${varName} = ${val}`));
        } else if (isCExp(exp)) {
            if (isAtomicExp(exp)) {
                if (isNumber(exp)) {
                    return makeOk((exp as NumExp).val.toString());
                }
                if (isBoolean(exp)) {
                    // Python booleans are capitalized: True / False
                    return makeOk((exp as BoolExp).val ? "True" : "False");
                }
                if (isString(exp)) {
                    return makeOk(`"${(exp as StrExp).val}"`);
                }
                if(isPrimOp(exp)) {
                    return makeOk(`"${(exp as PrimOp).op}"`);
                }
                if(isVarRef(exp)) {
                    return makeOk((exp as VarRef).var);
                }
               return makeFailure(`Unknown atomic expression: ${JSON.stringify(exp)}`);
            } else if (isCompoundExp(exp)) {
                /////////// to do
                if (isAppExp(exp)) {
                   const ratorRes = l2ToPython(exp.rator);
                   const randsRes = mapResult(l2ToPython, exp.rands); 
                   return bind(ratorRes, (rator: string) =>
                            bind(randsRes, (rands: string[]) => 
                                makeOk(`${rator}(${rands.join(", ")})`))); 
                } 
                if(isIfExp(exp)) {
                    const testRes = l2ToPython(exp.test);
                    const thenRes = l2ToPython(exp.then);
                    const altRes = l2ToPython(exp.alt);
                    return bind(testRes, (test: string) =>
                            bind(thenRes, (then: string) =>
                                bind(altRes, (alt: string) =>
                                    makeOk(`(${then} if ${test} else ${alt})`))));
                }
                if(isProcExp(exp)) {
                    const params = exp.args.map(arg => arg.var).join(", ");
                    // we know body has one exp only
                    const bodyRes = l2ToPython(exp.body[0]);
                    return bind(bodyRes, (body: string) => makeOk(`lambda ${params}: ${body}`));
                }
                
            }

        } else {
            return makeFailure(`Unknown expression type: ${JSON.stringify(exp)}`);
        }
    }
    return makeFailure("TODO");
}

