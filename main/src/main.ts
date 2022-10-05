/*
Name: Yap Yong Hong
Student ID: 31899412
*/
import "./style.css";
import { interval, fromEvent, merge} from 'rxjs'
import { map, scan, filter} from 'rxjs/operators'


function main() {

  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

  const Constants = {
    CanvasSize: 600,
    GameTickInterval: 10,
    StartTime: 0,
    SpeedIncrease: 0.5,
    RectHeight: 50,
    CarWidth: 50,
    CarStartX: 0,
    CarStartY: 550,
    CarDist: 200,
    LogWidth: 150,
    LogStartX: 0,
    LogStartY: 300,
    LogDist: 300,
    MedalStartX: 100,
    MedalStartY: 75,
    MedalRadius: 20,
    MedalDist: 100
  } as const

  type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Enter'
  type Event = 'keydown'

  // Four types of object
  type ViewType = 'frog' | 'car' | 'log' | 'medal'
  type Shape = 'rect' | 'circle'
  type Direction = 'left' | 'right'

  type ObjectId = Readonly<{id:string, idNum:string, createTime:number}>
  type ObjectAttr = Readonly<{pos:Vec, width:number, height:number, r:number}>
  interface IBody extends ObjectId, ObjectAttr {
    viewType: ViewType,
    shape: Shape,
    direction: Direction,
    velocity: number
  }

  // Every object that participates in physics is a Body
  type Body = Readonly<IBody>

  // Game state
  type State = Readonly<{
    time: number,
    frog: Body,
    cars: ReadonlyArray<Body>,
    logs: ReadonlyArray<Body>,
    medals: ReadonlyArray<Body>,
    medalsGet: number,
    moveUpCount: number,
    score: number,
    highestScore: number,
    gameOver: boolean,
  }>

  // Six types of game state transitions
  class Tick { constructor(public readonly elapsed:number) {} }
  class Left { constructor(public readonly x:number) {} }
  class Right { constructor(public readonly x:number) {} }
  class Up { constructor(public readonly y:number) {} }
  class Down { constructor(public readonly y:number) {} }
  class Restart { constructor(){} }

  // Six types of stream
  const 
    gameClock$ = interval(Constants.GameTickInterval)
      .pipe(map(elapsed => new Tick(elapsed))),

    keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
      fromEvent<KeyboardEvent>(document, e)
        .pipe(
          filter(({code}) => code === k),
          map(result)),

    moveLeft$ = keyObservable('keydown', 'ArrowLeft', () => new Left(50)),
    moveRight$ = keyObservable('keydown','ArrowRight',()=>new Right(50)),
    moveUp$ = keyObservable('keydown','ArrowUp', ()=>new Up(50)),
    moveDown$ = keyObservable('keydown','ArrowDown', ()=>new Down(50)),
    restart$ = keyObservable('keydown', 'Enter', () => new Restart());

  // create object
  const 
    createObj = (shp: Shape) => (viewType: ViewType) => (vel: number)=> (dir: Direction) => 
                (oid: ObjectId) => (oattr: ObjectAttr) => 
    <Body>{
      ...oid,
      ...oattr,
      viewType: viewType,
      shape: shp,
      direction: dir,
      velocity: dir==='right' ? vel : -vel,
      id: String(viewType) + String(oid.id)
    },
    createRectangle = createObj('rect'),
    createCircle = createObj('circle'),
    createCar = createRectangle('car')(1.2),
    createLog = createRectangle('log')(0.5),
    createMedal = createCircle('medal')(0)('right');
  
  // create frog
  function createFrog(idNumber: number): Body{
    return {
      id: "frog" + String(idNumber),
      idNum: String(idNumber),
      createTime: Constants.StartTime,
      viewType: 'frog',
      shape: 'circle',
      pos: new Vec(Constants.CanvasSize/2, 575),
      r: 25,
      width: 0, 
      height: 0,
      direction: "left",
      velocity: 0
    } 
  }

  const 
    // initialise the cars
    startCars = (col: number, row: number, initRow: number, cars: Body[]): Body[] => {
      if (col === 0){
        return cars;
      }
      else {
        if (row === 0){
          return startCars(col-1, initRow, initRow, cars);
        }
      }
      const newCar = 
        createCar(col%2===0 ? 'left' : 'right')
                  ({id:String(col)+String(row), idNum: String(col)+String(row), createTime:Constants.StartTime})
                  ({pos: new Vec(Constants.CarStartX + row*Constants.CarDist + col*100, 
                                  Constants.CarStartY - col*Constants.RectHeight), 
                    width:Constants.CarWidth, 
                    height:Constants.RectHeight,
                    r: 0});
      return startCars(col, row-1, initRow, cars.concat([newCar]));
    },

    // initialise the logs
    startLogs = (col: number, row: number, initRow: number, logs: Body[]): Body[] => {
      if (col === 0){
        return logs;
      }
      else {
        if (row === 0){
          return startLogs(col-1, initRow, initRow, logs);
        }
      }
      const newLog = 
        createLog(col%2===0 ? 'left' : 'right')
                  ({id:String(col)+String(row), idNum: String(col)+String(row), createTime:Constants.StartTime})
                  ({pos: new Vec(Constants.LogStartX + row*Constants.LogDist + col*100, 
                                  Constants.LogStartY - col*Constants.RectHeight), 
                    width:Constants.LogWidth, 
                    height:Constants.RectHeight,
                    r: 0});
      return startLogs(col, row-1, initRow, logs.concat([newLog]));
    },

    // initialise the medals
    startMedals = (col: number, medals: Body[]): Body[] => {
      if (col === 0){
        return medals;
      }
      else {
        const newMedal = 
          createMedal({id:String(col), idNum: String(col),createTime:Constants.StartTime})
                      ({pos: new Vec(Constants.MedalStartX + (col-1)*Constants.MedalDist,Constants.MedalStartY), 
                        width:0, 
                        height:0,
                        r: Constants.MedalRadius});
        return startMedals(col-1, medals.concat([newMedal]));
      }
    },

    // initialise game state
    initialState: State = {
      time: 0,
      frog: createFrog(0),
      cars: startCars(4, 2, 2, []),
      logs: startLogs(4, 2, 2, []),
      medals: startMedals(5, []),
      medalsGet: 0,
      moveUpCount: 0,
      score: 0,
      highestScore: 0,
      gameOver: false
    },

    // wrap a positions around edges of the screen
    torusWrap = ({x, y}:Vec) => { 
      const size = Constants.CanvasSize, 
        wrap = (v:number) => v < 0 ? v + size : v > size ? v - size : v;
      return new Vec(wrap(x), wrap(y))
    },
    
    // all movement comes through here (except frog)
    moveBody = (o: Body) => <Body>{
      ...o,
      pos: torusWrap(o.pos.add(new Vec(o.velocity)))
    },

    // check a State for collisions
    handleCollisions = (s:State) => {
      const 
        bodiesCollided = ([a, b]:[Body, Body]) => {
          if (b.shape === 'rect') {
            const distance = a.pos.sub(b.pos.add(new Vec(b.width/2, b.height/2))).len();
            return ((distance < (a.r+b.width/2)) && (a.pos.y === b.pos.y+b.height/2)) || distance < (a.r+b.height/2);
          }
          return a.pos.sub(b.pos).len() < a.r + b.r;
        },
        carsCollided = s.cars.filter(c => bodiesCollided([s.frog, c])).length > 0,
        collidedLogs = s.logs.filter(l => bodiesCollided([s.frog, l])),
        logsCollided = collidedLogs.length > 0,
        medalsCollided = s.medals.filter(m => bodiesCollided([s.frog, m])).length,
        collision = s.frog.pos.y > 300 ? carsCollided : s.frog.pos.y > 100 ? !logsCollided : false;

      // state: player get all the medals
      if (medalsCollided+s.medalsGet === 5){
          return <State>{
            ...s,
            frog: createFrog(0),
            medalsGet: 0,
            score: 0,
            highestScore: s.highestScore + 200,
            cars: s.cars.map((c) => {
              return {
                ...c,
                velocity: c.velocity > 0 ? c.velocity + Constants.SpeedIncrease : c.velocity - Constants.SpeedIncrease
              }
            }),
            logs: s.logs.map((l) => {
              return {
                ...l,
                velocity: l.velocity > 0 ? l.velocity + Constants.SpeedIncrease : l.velocity - Constants.SpeedIncrease
              }
            }),
          }
      }

      // state: another frog is created when reaches one medal
      else if (medalsCollided+s.medalsGet > s.medalsGet){
        return <State>{
          ...s,
          frog: createFrog(s.medalsGet+medalsCollided),
          medalsGet: s.medalsGet + medalsCollided,
          score: s.score + 200,
          highestScore: s.highestScore + 200,
          gameOver: collision,
        }
      }

      // state: the frog follows the object collided
      return <State>{
        ...s,
        frog: logsCollided
                ? {...s.frog, pos:new Vec(s.frog.pos.x+collidedLogs[0].velocity, s.frog.pos.y)} 
                : s.frog,
        gameOver: collision
      }
    },

    // interval tick: bodies move
    tick = (s:State, elapsed:number) => {
      if (s.gameOver){
        return {...initialState}
      }
      return handleCollisions({
        ...s, 
        cars: s.cars.map(moveBody), 
        logs: s.logs.map(moveBody),
        time: elapsed
      })
    },
    
    // state transducer
    reduceState = (s:State, event:Left|Right|Up|Down|Tick|Restart): State => {
      if (s.gameOver){
        if (event instanceof Restart){
          return initialState;
        }
        return <State>{
          ...s,
          cars: s.cars.map((c) => {
            return {
              ...c,
              velocity: 0
            }
          }),
          logs: s.logs.map((l) => {
            return {
              ...l,
              velocity: 0
            }
          })
        }
      }
      else{
        if (event instanceof Left){
          return {
            ...s,
            frog: {
              ...s.frog, 
              pos: s.frog.pos.y > 100 ? torusWrap(s.frog.pos.sub(new Vec(event.x))) : s.frog.pos
            }
          }
        }
        else if (event instanceof Right){
          return {
            ...s,
            frog: {
              ...s.frog, 
              pos: s.frog.pos.y > 100 ? torusWrap(s.frog.pos.add(new Vec(event.x))) : s.frog.pos
            }
          }
        }
        else if (event instanceof Up){
          return {
            ...s,
            frog: {
              ...s.frog, 
              pos: torusWrap(s.frog.pos.sub(new Vec(0, event.y)))
            },
            moveUpCount: s.moveUpCount + 1
          }
        }
        else if (event instanceof Down){
          return {
            ...s,
            frog: {
              ...s.frog, 
              pos: torusWrap(s.frog.pos.add(new Vec(0, event.y)))
            }
          }
        }
        else if (event instanceof Tick){
          return tick(s, event.elapsed);
        }
        else {
          return s;
        }
    }
    };

  // main game stream
  const subscription =
    merge(gameClock$, restart$,
      moveLeft$, moveRight$, moveUp$, moveDown$)
    .pipe(
      scan(reduceState, initialState))
    .subscribe(updateView);

  // Update the svg scene.  
  // This is the only impure function in this program
  function updateView(s: State) {
    const 
      svg = document.getElementById("svgCanvas")!,
      background = document.getElementById("background")!,
      moveUpCount = document.getElementById("moveUpCount")!,
      score = document.getElementById("score")!,
      highestScore = document.getElementById("highestScore")!,
      updateBodyView = (b: Body) => {
        function createBodyView() {
          const v = document.createElementNS(svg.namespaceURI, String(b.shape))!;
          v.setAttribute("id", String(b.id));
          v.setAttribute("x", String(b.pos.x));
          v.setAttribute("y", String(b.pos.y));
          v.setAttribute("width", String(b.width));
          v.setAttribute("height", String(b.height));
          v.setAttribute("cx", String(b.pos.x));
          v.setAttribute("cy", String(b.pos.y));
          v.setAttribute('r', String(b.r));
          v.classList.add(b.viewType);
          background.appendChild(v);
          return v;
        }
        const v = document.getElementById(b.id) || createBodyView();
        v.setAttribute("x", String(b.pos.x));
        v.setAttribute("y", String(b.pos.y));
        v.setAttribute("cx", String(b.pos.x));
        v.setAttribute("cy", String(b.pos.y));
      },
      show = (id:string, condition:boolean)=>((e:HTMLElement) => 
        condition ? e.classList.remove('hidden')
                  : e.classList.add('hidden'))(document.getElementById(id)!),
      setText = (elem: HTMLElement) => (text:string) => {
          elem.textContent = text;
      },
      setUpText = setText(moveUpCount),
      setScoreText = setText(score),
      setHighestScoreText = setText(highestScore)

    // update view for every object
      updateBodyView(s.frog)
    s.cars.forEach(updateBodyView);
    s.logs.forEach(updateBodyView);
    s.medals.forEach(updateBodyView);
    
    // update move up count and scores
    setUpText(String(s.moveUpCount));
    setScoreText(String(s.score));
    setHighestScoreText(String(s.highestScore));
    
    // hide the frogs which is not controlled currently
    show("frog0", "frog0" === s.frog.id || s.medalsGet >= 0);
    show("frog1", "frog1" === s.frog.id || s.medalsGet >= 1);
    show("frog2", "frog2" === s.frog.id || s.medalsGet >= 2);
    show("frog3", "frog3" === s.frog.id || s.medalsGet >= 3);
    show("frog4", "frog4" === s.frog.id || s.medalsGet >= 4);

    // show text when game over
    show("gameOver", s.gameOver);
    const gameOver = document.getElementById("gameOver")!;
    svg.appendChild(gameOver);
  }

}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

// Immutable vector class
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y);
  sub = (b:Vec) => new Vec(this.x - b.x, this.y - b.y);
  len = () => Math.sqrt(this.x*this.x + this.y*this.y);
  static Zero = new Vec();
}