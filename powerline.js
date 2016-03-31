#!/usr/bin/env node

// Powerline-style prompt in js instead of python.
// 100% inspired by https://github.com/milkbikis/powerline-bash

var child = require('child_process');

var COLOR =
{
	PATH_BG: [4, 237],
	PATH_FG: [0, 250],
	CWD_FG: [0, 254],
	SEPARATOR_FG: [0, 244],

	REPO_CLEAN_BG: [2, 148],
	REPO_CLEAN_FG: [0, 0],
	REPO_HAS_PENDING_BG: [3, 161],
	REPO_HAS_PENDING_FG: [0, 15],
	REPO_HAS_UNSTAGED_BG: [1, 161],
	REPO_HAS_UNSTAGED_FG: [0, 15],

	CMD_PASSED_BG: [7, 236],
	CMD_PASSED_FG: [0, 15],
	CMD_FAILED_BG: [7, 161],
	CMD_FAILED_FG: [0, 15],

	SVN_CHANGES_BG: [7, 148],
	SVN_CHANGES_FG: [0, 22],

	VIRTUAL_ENV_BG: [7, 35],
	VIRTUAL_ENV_FG: [0, 22]
};

var SYMBOLS =
{
	'compatible':
	{
		separator: '\u25b6',
		separator_thin: '\u276f'
	},
	'patched':
	{
		separator: '\ue0b0',
		separator_thin: '\ue0b1'
	}
};


//---------------------------------------------------

var COLOR_TEMPLATES =
{
	'bash': function(s) { return '\\[\\e' + s + '\\]'; },
	'zsh': function(s) { return '%{' + s + '%}'; }
};

function Shell(which)
{
	if (Object.keys(COLOR_TEMPLATES).indexOf(which) === -1)
		throw new Error('shell ' + which + ' not supported');

	this.name = which;
	this.colorTemplate = COLOR_TEMPLATES[which];
	this.reset = this.colorTemplate('[0m');
}

Shell.prototype.color = function(prefix, code)
{
	if (options.color === 'dos')
		var template = '[' + prefix[0] + code[0] + 'm';
	else if (options.color === 'ansi')
		var template = '[' + prefix + ';5;' + code[1] + 'm';

	return this.colorTemplate(template);
};

Shell.prototype.fgcolor = function(code)
{
	return this.color('38', code);
};

Shell.prototype.bgcolor = function(code)
{
	return this.color('48', code);
};

//---------------------------------------------------

function Powerline(options)
{
	options = options || {};
	this.options = {};
	this.options.shell = options.shell || 'zsh';
	this.options.color = options.color || 'ansi';
	this.options.mode = options.mode || 'patched';
	this.options.depth = options.depth || 3;
	this.options.showRepo = options.hasOwnProperty('showRepo') ? options.showRepo : true;
	this.options.showPath = options.hasOwnProperty('showPath') ? options.showPath : true;
	this.options.showRoot = options.hasOwnProperty('showRoot') ? options.showRoot : true;

	this.shell = new Shell(this.options.shell);

	this.separator = SYMBOLS[this.options.mode].separator;
	this.separator_thin = SYMBOLS[this.options.mode].separator_thin;

	this.segments = [];
	this.cwd = process.platform === 'win32' ? process.cwd().replace(/\\/g, '/') : process.cwd();
	this.home = process.platform === 'win32' ? process.env.HOME.replace(/\\/g, '/') : process.env.HOME;
	this.isRoot = process.platform !== 'win32' && process.getuid() === 0;
	this.error = options.hasOwnProperty('error') ? options.error : false;
}

Powerline.prototype.buildPrompt = function(callback)
{
	var self = this;

	this.addVirtualEnvSegment();
	this.addCWDSegment();
	this.addRepoSegment(function()
	{
		self.addRootIndicator();
		callback();
	});
};

Powerline.prototype.draw = function(code)
{
	var result = [];
	var shifted = this.segments.slice(1);
	shifted.push(null);

	for (var i = 0; i < this.segments.length; i++)
	{
		var item = this.segments[i];
		var next = shifted[i];

		result.push(item.draw(next));
	}

	result.push(this.shell.reset);
	return result.join('');
};

Powerline.prototype.addContextSegment = function()
{
	// if root or on another system, say so
	var ctx = '';
	if (this.isRoot)
		ctx += 'root';

	this.segments.push(new Segment(this,
		' ' + ctx + ' ',
		COLOR.VIRTUAL_ENV_FG,
		COLOR.VIRTUAL_ENV_BG
	));
};

Powerline.prototype.addCWDSegment = function()
{
	if (!this.options.showPath)
		return;

	var cwd = this.cwd;
	var home = this.home;

	if (cwd.indexOf(home) === 0)
		cwd = cwd.replace(home, '~');

	if (cwd[0] === '/')
		cwd = cwd.substring(1, cwd.length);

	var names = cwd.split('/');
	if (this.options.depth > 1)
	{
		if (names.length > this.options.depth)
		{
			var diff = names.length - this.options.depth;
			var start = this.options.depth > 4 ? 2 : 1;
			names.splice(start, diff, '\u2026');
		}

		for (var i = 0; i < names.length - 1; i++)
		{
			this.segments.push(new Segment(
				this,
				' ' + names[i] + ' ',
				COLOR.PATH_FG,
				COLOR.PATH_BG,
				this.separator_thin,
				COLOR.SEPARATOR_FG
			));
		}
	}

	this.segments.push(new Segment(
		this,
		' ' + names[names.length - 1] + ' ',
		COLOR.CWD_FG,
		COLOR.PATH_BG
	));
};

Powerline.prototype.addRootIndicator = function()
{
	if (!this.options.showRoot)
		return;

	var bg = this.error ? COLOR.CMD_FAILED_BG : COLOR.CMD_PASSED_BG;
	var fg = this.error ? COLOR.CMD_FAILED_FG : COLOR.CMD_PASSED_FG;

	var symbol = ' ';
	if (this.isRoot)
		symbol += '\u26a1';
	if (this.error)
		symbol += '✘';
	if (symbol.length === 1)
		symbol += '\\$';
	symbol += ' ';

	this.segments.push(new Segment(this, symbol, fg, bg));
};

Powerline.prototype.addVirtualEnvSegment = function()
{
	var env = process.env.VIRTUAL_ENV;
	if (!env)
		return;

	var path = require('path');

	this.segments.push(new Segment(this,
		' ' + path.basename(env) + ' ',
		COLOR.VIRTUAL_ENV_FG,
		COLOR.VIRTUAL_ENV_BG
	));
};

Powerline.prototype.addRepoSegment = function(callback)
{
	if (!this.options.showRepo)
		return callback();

	var self = this;

	self.addGitSegment(function(found)
	{
		if (found) return callback();
		self.addSVNSegment(callback);
	});
};

Powerline.prototype.addGitSegment = function(callback)
{
	var self = this;

	var hasPending = false;
	var hasUnstaged = false;
	var branch;

	child.exec('git status -sb --ignore-submodules --porcelain', function(err, stdout, stderr)
	{
		if (err || !stdout)
			return callback(false);

		var lines = stdout.trim().split('\n');

		var status = lines.shift().trim();
		var matches = status.match(/^## ([^\.\s]*)/);
		if (matches)
			branch = matches[1];
		if (branch !== 'master')
			branch = '⭠ ' + branch;

		matches = status.match(/ahead\s+(\d+)/);
		if (matches)
			branch += '+' + matches[1] + ' ';

		matches = status.match(/behind\s+(\d+)/);
		if (matches)
			branch += '-' + matches[1] + ' ';

		for (var i = 0; i < lines.length; i++)
		{
			if (lines[i][0] !== ' ')
				hasPending = true;
			if (lines[i][1] !== ' ')
				hasUnstaged = true;

			if (hasPending && hasUnstaged)
				break;
		}

		if (hasUnstaged)
		{
			 var fg = COLOR.REPO_HAS_UNSTAGED_FG;
			 var bg = COLOR.REPO_HAS_UNSTAGED_BG;
		}
		else if (hasPending)
		{
			 var fg = COLOR.REPO_HAS_PENDING_FG;
			 var bg = COLOR.REPO_HAS_PENDING_BG;
		}
		else
		{
			 var fg = COLOR.REPO_HAS_CLEAN_FG;
			 var bg = COLOR.REPO_HAS_CLEAN_BG;
		}

		self.segments.push(new Segment(self, ' ' + branch, fg, bg));
		callback(true);
	});
};

Powerline.prototype.addSVNSegment = function(callback)
{
	var self = this;
	var fs = require('fs');

	if (!fs.existsSync('.svn'))
		return callback(false);

	child.exec('svn status | grep -c "^[ACDIMRX\\!\\~]"', function(err, stdout, stderr)
	{
		// TODO that grep command always exits with an error; fix
		if (!stdout || !stdout.length)
			return callback(true);

		var changes = parseInt(stdout.trim(), 10);
		if (changes > 0)
		{
			self.segments.push(new Segment(self,
				' ' + changes + ' ',
				COLOR.SVN_CHANGES_FG,
				COLOR.SVN_CHANGES_BG
			));
		}
		callback(true);
	});
};

//---------------------------------------------------

function Segment(powerline, content, fg, bg, separator, separatorFG)
{
	this.shell = powerline.shell;
	this.content = content;
	this.fg = fg;
	this.bg = bg;
	this.separator = separator || powerline.separator;
	this.separatorFG = separatorFG || bg;
}

Segment.prototype.draw = function(nextSegment)
{
	var sep, pieces;

	if (nextSegment)
		sep = this.shell.bgcolor(nextSegment.bg);
	else
		sep = this.shell.reset;

	pieces = [
		this.shell.fgcolor(this.fg),
		this.shell.bgcolor(this.bg),
		this.content,
		sep,
		this.shell.fgcolor(this.separatorFG),
		this.separator
	];

	return pieces.join('');
};

//---------------------------------------------------

function parseOptions(args)
{
	args = args || [];
	var options = {};

	while (args.length)
	{
		var opt = args.shift();
		switch (opt)
		{
			case '--shell':
				options.shell = args.shift();
				break;

			case '--color':
				options.color = args.shift();
				break;

			case '--mode':
				options.mode = args.shift();
				break;

			case '--depth':
				options.depth = parseInt(args.shift(), 10);
				break;

			case '--repo-only':
				options.showRepo = true;
				options.showPath = false;
				options.showRoot = false;
				break;

			case '--no-repo':
				options.showRepo = false;
				break;

			case '--no-root':
				options.showRoot = false;
				break;

			default:
				options.error = (opt !== '0');
		}
	}

	return options;
}

if (require.main === module)
{
	var options = parseOptions(process.argv.slice(2));
	var p = new Powerline(options);
	p.buildPrompt(function()
	{
		process.stdout.write(p.draw());
	});
}

exports.Powerline = Powerline;
exports.Segment = Segment;
exports.parseOptions = parseOptions;
