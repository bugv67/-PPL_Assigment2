import {  evalL3program } from '../L3/L3-eval-sub';
import { SExpValue, Value, valueToString } from "../L3/L3-value";
import { Result, bind, isOk, makeOk, makeFailure } from "../shared/result";
import { parseL3} from "../L3/L3-ast";


const evalP = (x: string): Result<Value> =>
    bind(parseL3(x), evalL3program);

const evalP2String = (x: string): string => {
    const res : Result<SExpValue> = bind(parseL3(x), evalL3program);
    return isOk(res) ? valueToString(res.value) : res.message;
}

describe('Q2B Tests for substitution model', () => {
    
    it("Test class definition", () => {
        expect(evalP2String(`
        (L3
         (define pair 
            (class (a b) 
               ((first (lambda () a)) 
                (second (lambda () b))
                (sum (lambda () (+ a b)))
                (f (lambda (k) (/ (* k a) (* k b))))
               )
             )
         )
         pair
        )`)).toStrictEqual("Class");
    });

    it("Test object definition", () => {
        expect(evalP2String(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            p34
        )
        `)).toStrictEqual("Object");
    });    
    
    it("Test object methods application", () => {

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'first)
        )
        `)).toStrictEqual(makeOk(3));

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'second)
        )
        `)).toStrictEqual(makeOk(4));

        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (second (lambda () b))
                   (sum (lambda () (+ a b)))
                   (f (lambda (k) (/ (* k a) (* k b))))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'sum)
        )
        `)).toStrictEqual(makeOk(7));

    });    

    it("Test object methods application with parameters", () => {

    expect(evalP(`
    (L3
        (define pair 
           (class (a b) 
              ((first (lambda () a)) 
               (second (lambda () b))
               (sum (lambda () (+ a b)))
               (f (lambda (k) (/ (* k a) (* k b))))
              )
            )
        )
        (define p34 (pair 3 4))
        (p34 'f 2)
    )
    `)).toStrictEqual(makeOk(0.75));
});


it("Test unknown methods application for substitution model", () => {

    expect(evalP(`
    (L3
        (define pair 
          (class (a b) 
           ((first (lambda () a)) 
            (second (lambda () b))
            (sum (lambda () (+ a b)))
            (f (lambda (k) (/ (* k a) (* k b))))
           )
          )
        )
        (define p34 (pair 3 4))
        (p34 'power)
    )
`)).toStrictEqual(makeFailure("Unrecognized method: power"));

});

it("Test unknown field in methods application", () => {

    expect(evalP(`
    (L3
      (define pair 
        (class (a b) 
           ((first (lambda () a)) 
            (second (lambda () b))
            (sum (lambda () (+ a c)))
            (f (lambda (k) (/ (* k a) (* k b))))
           )
        )
      )
      (define p34 (pair 3 4))
      (p34 'sum)
    )
`)).toStrictEqual(makeFailure("var not found: c"));

});

it("Test nested object methods application", () => {

    expect(evalP(`
    (L3
        (
         (lambda (obj) (obj 'first))
         (
           (class (a b) 
              ((first (lambda () a)) 
               (second (lambda () b))
               (sum (lambda () (+ a b)))
               (f (lambda (k) (/ (* k a) (* k b))))
              )
            )
            3 4
         )
       )
    )
    `)).toStrictEqual(makeOk(3));


 
});

it("Test field shadowing inside method arguments", () => {
        // Verifies that substitution of method parameters properly shadows class fields 
        // without leaving stale field values behind in the inner expressions.
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a)) 
                   (shadow-test (lambda (a) (+ a b)))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'shadow-test 10)
        )
        `)).toStrictEqual(makeOk(14)); // 10 (substituted arg) + 4 (substituted field)
    });

    it("Test substitution within nested lambdas returned by methods", () => {
        // Tests that fields are substituted correctly even when deep inside 
        // a lambda returned by a method (higher-order method output).
        expect(evalP(`
        (L3
            (define adder-factory
               (class (base) 
                  ((get-adder (lambda () (lambda (x) (+ base x))))
                  )
                )
            )
            (define factory (adder-factory 100))
            (define my-adder (factory 'get-adder))
            (my-adder 5)
        )
        `)).toStrictEqual(makeOk(105));
    });

    it("Test object preservation across multiple calls", () => {
        // Ensures that substituting into an object method doesn't structurally 
        // corrupt or mutate the original object AST representation for subsequent calls.
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((calc (lambda (x) (* (+ a b) x)))
                  )
                )
            )
            (define p25 (pair 2 5))
            (+ (p25 'calc 2) (p25 'calc 3))
        )
        `)).toStrictEqual(makeOk(35)); // (7 * 2) + (7 * 3) = 14 + 21 = 35
    });

    it("Test global variable visibility in substitution model", () => {
        // Verifies that variables not belonging to class fields or method arguments 
        // are left untouched by the substitution passes so they can be free variables 
        // resolved at the global level.
        expect(evalP(`
        (L3
            (define global-modifier 10)
            (define scale-class
               (class (val) 
                  ((get-scaled (lambda () (+ val global-modifier)))
                  )
                )
            )
            (define instance (scale-class 5))
            (instance 'get-scaled)
        )
        `)).toStrictEqual(makeOk(15));
    });

    it("Test passing objects as arguments to methods under substitution", () => {
        // Ensures that when an object AST structure is passed as an argument to 
        // another object's method, it substitutes cleanly without variable name clashes.
        expect(evalP(`
        (L3
            (define container 
               (class (stored-value) 
                  ((get (lambda () stored-value))
                  )
                )
            )
            (define inspector
               (class () 
                  ((inspect-and-add (lambda (obj bonus) (+ (obj 'get) bonus)))
                  )
                )
            )
            (define c (container 40))
            (define ins (inspector))
            (ins 'inspect-and-add c 2)
        )
        `)).toStrictEqual(makeOk(42));
    });

    it("Test zero-argument class and zero-argument method processing", () => {
        // Edge case verifying that empty parameter arrays do not crash 
        // the substitution map functions.
        expect(evalP(`
        (L3
            (define dummy 
               (class () 
                  ((const-val (lambda () 999))
                  )
                )
            )
            (define d (dummy))
            (d 'const-val)
        )
        `)).toStrictEqual(makeOk(999));
    });

    it("Test wrong number of arguments to method error string", () => {
        // Confirms error handling behaves identically to your environment model behavior
        expect(evalP(`
        (L3
            (define pair 
               (class (a b) 
                  ((first (lambda () a))
                  )
                )
            )
            (define p34 (pair 3 4))
            (p34 'first 99) 
        )
        `)).toStrictEqual(makeFailure("Wrong number of arguments to method first. Expected 0, got 1"));
    });


});
