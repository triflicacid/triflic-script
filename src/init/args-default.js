// Default values for Runspace.opts
module.exports = () => {
  return {
    defineFuncs: true,
    prompt: '>> ',
    intro: true,
    niceErrors: true,
    imag: "i",
    bidmas: true,
    multiline: true,
    timeExecution: false,
  };
};