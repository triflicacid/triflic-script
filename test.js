function func(obj) {
  obj.a = 5;
  obj.b = 5;
}

let obj = {};
console.log(obj);
func(obj);
console.log(obj);