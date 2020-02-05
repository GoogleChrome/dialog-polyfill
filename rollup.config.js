import postcss from 'rollup-plugin-postcss';


export default [
  {
  	input: 'index.js',
    output: {
      file: 'dist/dialog-polyfill.esm.js',
      format: 'esm'
    },
	plugins: [
	  postcss({
	    plugins: [ ]
	  })
	]
  },

  {
  	input: 'index.js',
    output: {
      file: 'dist/dialog-polyfill.cjs.js',
      format: 'cjs'
    },
	plugins: [
	  postcss({
	    plugins: [ ]
	  })
	]
  },

  {
  	input: 'index.js',
    output: {
      file: 'dist/dialog-polyfill.js',
      format: 'umd',
      name: 'dialogPolyfill'
    },
	plugins: [
	  postcss({
	    plugins: [ ]
	  })
	]
  }
]
