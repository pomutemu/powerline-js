/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should()
	;

var
	child = require('child_process'),
	fs = require('fs'),
	path = require('path'),
	powerline = require('../powerline')
	;

function execute(args, callback)
{
	child.exec('./powerline.js' + args, function(err, stdout, stderr)
	{
		if (err)
			throw(err);

		callback(stderr, stdout);
	});
}

describe('powerline.js', function()
{
	describe('#parseOptions', function()
	{
		it('parses an empty options array', function()
		{
			var opts = powerline.parseOptions();
			opts.should.be.an('object');
			Object.keys(opts).length.should.equal(0);
		});

		it('parses a typical array', function()
		{
			var opts = powerline.parseOptions(['--shell', 'bash', '--depth', '3', '2']);
			Object.keys(opts).length.should.equal(3);
			opts.shell.should.equal('bash');
			opts.depth.should.equal(3);
			opts.error.should.equal(true);
		});
	});

	describe('#constructor', function()
	{
		it('is constructed with reasonable defaults', function()
		{
			var p = new powerline.Powerline();
			p.should.have.property('options');
			p.options.should.be.an('object');
			p.options.shell.should.equal('zsh');
			p.options.color.should.equal('ansi');
			p.options.mode.should.equal('patched');
			p.options.depth.should.equal(3);
			p.options.showRepo.should.equal(true);
			p.options.showPath.should.equal(true);
			p.options.showRoot.should.equal(true);
		});

		it('generates a prompt with the given options', function(done)
		{
			var p = new powerline.Powerline();
			p.cwd = '~/projects/powerline-js';
			p.buildPrompt(function()
			{
				p.segments.length.should.equal(5);
				p.segments[0].content.should.equal(' ~ ');
				p.segments[3].content.indexOf(' master').should.equal(0);
				done();
			});
		});

		it('throws when passed an unknown shell', function()
		{
			var badOptions = function()
			{
				var p = new Powerline({ shell: 'tcsh'});
			};

			badOptions.should.throw();
		});

		it('obeys the mode option', function()
		{
			var p = new powerline.Powerline({mode: 'compatible'});
			p.options.mode.should.equal('compatible');
			p.separator.should.equal('\u25b6');
			p.separator_thin.should.equal('\u276f');
		});

		it('obeys the repo-only option', function(done)
		{
			var opts = powerline.parseOptions(['--repo-only']);
			var p = new powerline.Powerline(opts);
			p.cwd = '~/projects/powerline-js';
			p.buildPrompt(function()
			{
				p.segments.length.should.equal(1);
				p.segments[0].content.indexOf(' master').should.equal(0);
				done();
			});
		});

		it('obeys the no-repo option', function(done)
		{
			var opts = powerline.parseOptions(['--no-repo']);
			var p = new powerline.Powerline(opts);
			p.cwd = '~/projects/powerline-js';
			p.buildPrompt(function()
			{
				p.segments.length.should.equal(4);
				done();
			});
		});
	});

	describe('#working directory', function()
	{
		var deepPath = '/this/is/a/deep/path/certainly/ohyes';
		var cwd = process.platform === 'win32' ? process.cwd().replace(/\\/g, '/') : process.cwd();

		it('obeys the depth option', function()
		{
			var p = new powerline.Powerline({depth: 6});
			p.cwd = cwd + deepPath;
			p.addCWDSegment();
			p.segments.length.should.equal(7);
		});

		it('handles very shallow depths gracefully', function()
		{
			var p = new powerline.Powerline({depth: 1});
			p.cwd = cwd + deepPath;
			p.addCWDSegment();
			p.segments.length.should.equal(1);
		});
	});

	describe('#git', function()
	{
		it('displays the git repo branch', function(done)
		{
			var p = new powerline.Powerline();
			p.addGitSegment(function()
			{
				p.segments.length.should.equal(1);
				p.segments[0].content.indexOf(' master').should.equal(0);
				done();
			});
		});
	});
});
