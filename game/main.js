var image = new Image('images/saiyan.png');
var x = 0, xVel = 1;
var y = 0, yVel = 1;

// initialize the game
screen.frameRate = 60;  // note: 60fps is the default.
Dispatch.onUpdate(doUpdate);
Dispatch.onRender(doRender);

function doUpdate()
{
	// put code here to update your game every frame, for example moving
	// sprites and updating animations.
	x += xVel;
	y += yVel;
	if (x <= 0) { x = 0; xVel = 1; }
	if (x >= screen.width - image.width) {
		x = screen.width - image.width;
		xVel = -1;
	}
	if (y <= 0) { y = 0; yVel = 1; }
	if (y >= screen.height - image.height) {
		y = screen.height - image.height;
		yVel = -1;
	}
}

function doRender()
{
	// put code here to draw a frame.  don't do anything other than rendering
	// here, as renders can be skipped and thus are not guaranteed to match the
	// frame rate.
	prim.rect(screen, 0, 0, screen.width, screen.height, Color.DodgerBlue);
	prim.ellipse(screen,
		screen.width / 2, screen.height / 2,
		screen.width / 4, screen.height / 4,
		Color.Chartreuse, Color.DarkGreen);
	prim.lineEllipse(screen,
		screen.width / 2, screen.height / 2,
		screen.width / 4, screen.height / 4,
		Color.Black);

	prim.blit(screen, x, y, image);
	prim.lineRect(screen, x, y, image.width, image.height, 1, Color.Black);
}
