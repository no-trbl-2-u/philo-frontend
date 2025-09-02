/* eslint-disable no-unused-vars */

// TODO: I probably need to include "typescript" abilities 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Compass, Heart, Brain, Sword, Shield, Zap, Package } from 'lucide-react';

// =============================================================================
// TYPE DEFINITIONS (Matching Haskell Backend)
// =============================================================================

type PhilosophicalAlignment = 'Utilitarian' | 'Existentialist' | 'Nihilist' | 'Undecided';
type PermanentMarker = 'Hypocrite' | 'Hedonist' | 'Sophist' | 'Martyr';
type ItemType = 'Weapon' | 'Armor' | 'Accessory' | 'Consumable';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

type FallacyType =
  | 'AdHominem'
  | 'AppealToAuthority'
  | 'Equivocation'
  | 'StrawMan'
  | 'FalseDialemma'
  | 'SlipperySlope'
  | 'CircularReasoning'
  | 'AppealToConsequences';

interface LogEntry {
  timestamp: string;
  choice: string;
  impact: number;
  reason: string;
}

interface AuthenticityMetric {
  value: number;
  history: LogEntry[];
  permanentMarkers: PermanentMarker[];
}

interface TemporaryEffect {
  duration: number;
  statBonus: number;
  penalty: number;
}

interface Item {
  itemId: string;
  name: string;
  itemType: ItemType;
  bodyModifier: number;
  mindModifier: number;
  heartModifier: number;
  authenticityImpact: number;
  temporaryEffect?: TemporaryEffect;
  description: string;
  philosophicalMeaning: string;
}

interface Fallacy {
  fallacyType: FallacyType;
  argument: string;
  correctIdentification: string;
  explanation: string;
  damage: number;
}

interface PlayerState {
  playerId: string;
  name: string;
  body: number;
  mind: number;
  heart: number;
  hitPoints: number;
  maxHitPoints: number;
  authenticityMetric: AuthenticityMetric;
  philosophicalAlignment: PhilosophicalAlignment;
  inventory: Item[];
  equippedFallacies: Fallacy[];
  experience: number;
  level: number;
  activeEffects: TemporaryEffect[];
}

interface Enemy {
  enemyId: string;
  name: string;
  historicalFigure: string;
  representedFlaw: FallacyType;
  hitPoints: number;
  maxHitPoints: number;
  weakness: FallacyType;
  lore: string;
}

interface Scenario {
  scenarioId: string;
  title: string;
  description: string;
  choices: Choice[];
  philosophicalBasis: string;
}

interface Choice {
  choiceId: string;
  text: string;
  alignmentInfluence: PhilosophicalAlignment;
  authenticityChange: number;
  reasoning: string;
}

interface CombatOutcome {
  success: boolean;
  damage: number;
  explanation: string;
  experienceGained: number;
  combatOutcome: any,
  updatedPlayer: any,
  continuesCombat: any;
}

// =============================================================================
// API COMMUNICATION LAYER
// =============================================================================

const API_BASE = 'http://localhost:8080/api';

/**
 * Creates HTTP headers for API requests
 * Design: Consistent headers with proper content type for JSON communication
 */
const createHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

/**
 * Generic API request function with error handling
 * Design: Centralized HTTP communication with comprehensive error handling
 */

function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetch(`${API_BASE}${endpoint}`, { headers: createHeaders(), ...options }).then(response => {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  });
}

/**
 * Creates a new player character
 * Design: Initializes player state on backend and returns complete PlayerState
 */
function createPlayer(name: string, alignment: PhilosophicalAlignment): Promise<PlayerState> {
  return apiRequest<PlayerState>('/player/create', {
    method: 'POST',
    body: JSON.stringify({
      playerName: name,
      initialAlignment: alignment,
    }),
  });
}

/**
 * Retrieves current player state from backend
 */

function getPlayerState(playerId: string): Promise<PlayerState> {
  return apiRequest<PlayerState>(`/player/${playerId}`);
}

/**
 * Submits a game action to the backend
 * Design: Handles all player interactions with the game world
 */
function submitGameAction(playerId: string, action: { type: string; scenarioId?: string; choiceId?: string; syllogismId?: string; playerAnswer?: boolean; enemyId?: string }): Promise<any> {
  return apiRequest('/action', {
    method: 'POST',
    body: JSON.stringify({
      playerId,
      action,
    }),
  });
}

/**
 * Fetches available scenarios from backend
 */
function getScenarios(): Promise<Scenario[]> {
  return apiRequest<Scenario[]>('/scenarios');
}

/**
 * Handles syllogism combat resolution
 */
function resolveSyllogismCombat(playerId: string, syllogismId: string, answer: boolean, enemyId: string): Promise<CombatOutcome> {
  return apiRequest('/combat/syllogism', {
    method: 'POST',
    body: JSON.stringify({
      requestPlayerId: playerId,
      syllogismId,
      playerAnswer: answer,
      enemyId,
    }),
  });
}

// =============================================================================
// MAIN GAME COMPONENT
// =============================================================================

/**
 * Main game application component
 * Design: Manages global game state and coordinates all UI components
 */
function PhilosophicalRPG(): React.FC {
  // Game state management
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [gamePhase, setGamePhase] = useState<'character-creation' | 'exploration' | 'combat' | 'scenario' | 'ending'>('character-creation');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastCombatResult, setLastCombatResult] = useState<CombatOutcome | null>(null);

  // Canvas reference for game rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Initializes a new game with player creation
   * Design: Sets up initial game state and transitions to exploration phase
   */
  const handleCreatePlayer = async (name: string, alignment: PhilosophicalAlignment) => {
    try {
      const newPlayer = await createPlayer(name, alignment);
      setPlayerState(newPlayer);
      setGamePhase('exploration');
    } catch (error) {
      console.error('Failed to create player:', error);
    }
  };

  /**
   * Handles player choices in philosophical scenarios
   * Design: Processes moral decisions and updates authenticity metric
   */
  const handleScenarioChoice = async (choiceId: string) => {
    if (!playerState || !currentScenario) return;

    try {
      const response = await submitGameAction(playerState.playerId, {
        type: 'MakeChoice',
        scenarioId: currentScenario.scenarioId,
        choiceId,
      });

      if (response.type === 'StateUpdate') {
        setPlayerState(response.playerState);
        setCurrentScenario(null);
        setGamePhase('exploration');
      }
    } catch (error) {
      console.error('Failed to process choice:', error);
    }
  };

  /**
   * Handles syllogism combat resolution
   * Design: Processes logical arguments and applies combat consequences
   */
  const handleSyllogismAnswer = async (answer: boolean) => {
    if (!playerState || !currentEnemy) return;

    try {
      const result = await resolveSyllogismCombat(
        playerState.playerId,
        'current_syllogism', // Would be dynamic in full implementation
        answer,
        currentEnemy.enemyId
      );

      setLastCombatResult(result.combatOutcome);
      setPlayerState(result.updatedPlayer);

      if (!result.continuesCombat) {
        setCurrentEnemy(null);
        setGamePhase('exploration');
      }
    } catch (error) {
      console.error('Failed to resolve combat:', error);
    }
  };

  // =============================================================================
  // CANVAS RENDERING SYSTEM
  // =============================================================================

  /**
   * Renders the game world on HTML5 Canvas
   * Design: Minimalist pixel art aesthetic inspired by Mörk Borg's zine-like style
   */
  const renderGameWorld = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !playerState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with dark, atmospheric background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render based on current game phase
    switch (gamePhase) {
      case 'exploration':
        renderExplorationView(ctx);
        break;
      case 'combat':
        renderCombatView(ctx);
        break;
      case 'scenario':
        renderScenarioView(ctx);
        break;
    }
  }, [playerState, gamePhase, currentEnemy, currentScenario]);

  /**
   * Renders exploration phase - player navigating the world
   * Design: Simple top-down view with atmospheric elements
   */
  const renderExplorationView = (ctx: CanvasRenderingContext2D) => {
    // Background atmosphere - dying world aesthetic
    ctx.fillStyle = '#2d2d2d';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      ctx.fillRect(x, y, 1, 1); // Atmospheric dust/ash particles
    }

    // Player sprite (simple geometric representation)
    ctx.fillStyle = getAlignmentColor(playerState?.philosophicalAlignment || 'Undecided');
    ctx.fillRect(390, 290, 20, 20); // Centered player

    // Player authenticity aura (visual representation of spiritual state)
    const authValue = playerState?.authenticityMetric.value || 0;
    ctx.globalAlpha = authValue / 200; // Stronger aura for higher authenticity
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(385, 285, 30, 30);
    ctx.globalAlpha = 1.0;

    // Interaction prompts
    ctx.fillStyle = '#cccccc';
    ctx.font = '16px monospace';
    ctx.fillText('Press SPACE to continue journey', 250, 500);
    ctx.fillText('Press E to examine surroundings', 250, 520);
  };

  /**
   * Renders combat phase - logical battle interface
   * Design: Focus on text and logical structure rather than action graphics
   */
  const renderCombatView = (ctx: CanvasRenderingContext2D) => {
    // Combat background
    ctx.fillStyle = '#3d1a1a'; // Dark red for intellectual conflict
    ctx.fillRect(0, 0, 800, 600);

    // Enemy representation
    if (currentEnemy) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(600, 200, 40, 60); // Enemy sprite position

      // Enemy health bar
      const healthPercentage = currentEnemy.hitPoints / currentEnemy.maxHitPoints;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(550, 180, 140, 10);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(550, 180, 140 * healthPercentage, 10);

      // Enemy name and lore
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText(currentEnemy.name, 500, 170);
    }

    // Combat instructions
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px monospace';
    ctx.fillText('Logical Combat: Analyze the argument structure', 50, 500);
    ctx.fillText('Success requires both courage and wisdom', 50, 520);
  };

  /**
   * Renders scenario phase - philosophical choice presentation
   * Design: Clean, readable text focus for complex moral decisions
   */
  const renderScenarioView = (ctx: CanvasRenderingContext2D) => {
    // Scenario background - neutral for focus on text
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, 800, 600);

    // Title area
    if (currentScenario) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(currentScenario.title, 50, 50);

      // Philosophical basis
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '10px monospace';
      ctx.fillText(`Source: ${currentScenario.philosophicalBasis}`, 50, 70);
    }
  };

  /**
   * Gets color associated with philosophical alignment
   * Design: Visual representation of player's worldview
   */
  const getAlignmentColor = (alignment: PhilosophicalAlignment): string => {
    switch (alignment) {
      case 'Utilitarian': return '#4CAF50';    // Green - growth and harmony
      case 'Existentialist': return '#FF9800'; // Orange - individual flame
      case 'Nihilist': return '#9C27B0';       // Purple - void and decay
      case 'Undecided': return '#757575';      // Gray - neutrality
    }
  };

  // Update canvas rendering when state changes
  useEffect(() => {
    renderGameWorld();
  }, [renderGameWorld]);

  // =============================================================================
  // UI COMPONENTS
  // =============================================================================

  /**
   * Character Creation Interface
   * Design: Simple, focused interface for initial philosophical choice
   */
  const CharacterCreation: React.FC = () => {
    const [name, setName] = useState('');
    const [selectedAlignment, setSelectedAlignment] = useState<PhilosophicalAlignment>('Undecided');

    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl">
          <h1 className="text-3xl font-bold mb-6 text-center">The Philosophical Journey Begins</h1>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Character Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your character's name"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-4">Initial Philosophical Inclination</label>
            <div className="space-y-3">
              {(['Undecided', 'Utilitarian', 'Existentialist', 'Nihilist'] as PhilosophicalAlignment[]).map((alignment) => (
                <label key={alignment} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="alignment"
                    value={alignment}
                    checked={selectedAlignment === alignment}
                    onChange={(e) => setSelectedAlignment(e.target.value as PhilosophicalAlignment)}
                    className="text-blue-500"
                  />
                  <span className="flex-1">
                    <span className="font-medium" style={{ color: getAlignmentColor(alignment) }}>
                      {alignment}
                    </span>
                    <p className="text-sm text-gray-400 mt-1">
                      {getAlignmentDescription(alignment)}
                    </p>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => name.trim() && handleCreatePlayer(name, selectedAlignment)}
            disabled={!name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded transition-colors"
          >
            Begin Journey
          </button>
        </div>
      </div>
    );
  };

  /**
   * Gets description for philosophical alignment choice
   * Design: Educational context for initial philosophical direction
   */
  const getAlignmentDescription = (alignment: PhilosophicalAlignment): string => {
    switch (alignment) {
      case 'Undecided':
        return 'Let your choices determine your philosophy through the journey';
      case 'Utilitarian':
        return 'Seek the greatest good for the greatest number of people';
      case 'Existentialist':
        return 'Create your own meaning through authentic choice and responsibility';
      case 'Nihilist':
        return 'Recognize that existence has no inherent meaning or purpose';
    }
  };

  /**
   * Main Game Interface with Sidebar and Canvas
   * Design: Layout matching specification - sidebar, hotbar, canvas game view
   */
  const GameInterface: React.FC = () => {
    return (
      <div className="h-screen bg-gray-900 text-white flex">
        {/* Main Game Canvas Area */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-gray-600 bg-black"
            style={{ imageRendering: 'pixelated' }} // Crisp pixel art rendering
          />

          {/* Game Phase Overlays */}
          {gamePhase === 'scenario' && currentScenario && (
            <ScenarioOverlay scenario={currentScenario} onChoice={handleScenarioChoice} />
          )}

          {gamePhase === 'combat' && currentEnemy && (
            <CombatOverlay enemy={currentEnemy} onSyllogismAnswer={handleSyllogismAnswer} />
          )}
        </div>

        {/* Collapsible Right Sidebar */}
        <div className={`bg-gray-800 transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-80'} border-l border-gray-600`}>
          <div className="p-4">
            {/* Collapse/Expand Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full mb-4 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center justify-center"
            >
              {sidebarCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>

            {!sidebarCollapsed && playerState && (
              <>
                <AuthenticityCompass player={playerState} />
                <PlayerStats player={playerState} />
                <EquippedFallacies player={playerState} />
              </>
            )}
          </div>
        </div>

        {/* Bottom Hotbar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-600 p-4">
          <div className="flex justify-center space-x-4">
            {playerState && <PlayerHotbar player={playerState} />}
          </div>
        </div>
      </div>
    );
  };

  // =============================================================================
  // AUTHENTICITY COMPASS COMPONENT
  // =============================================================================

  /**
   * Visual representation of player's authenticity metric
   * Design: Central moral compass showing spiritual "hit points"
   */
  const AuthenticityCompass: React.FC<{ player: PlayerState }> = ({ player }) => {
    const authValue = player.authenticityMetric.value;
    const markers = player.authenticityMetric.permanentMarkers;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <Compass className="mr-2" size={20} />
          Authenticity Compass
        </h3>

        {/* Circular authenticity meter */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-32 h-32 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#374151"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Authenticity level circle */}
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke={getAuthenticityColor(authValue)}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${(authValue / 100) * 351.86} 351.86`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold">{authValue.toFixed(1)}</span>
          </div>
        </div>

        {/* Authenticity status */}
        <div className="text-center">
          <p className="text-sm text-gray-300">
            {getAuthenticityStatus(authValue)}
          </p>
          {markers.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-400">Permanent Marks:</p>
              {markers.map((marker, idx) => (
                <span key={idx} className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded mr-1">
                  {marker}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Gets color for authenticity level
   * Design: Visual feedback for moral state
   */
  const getAuthenticityColor = (value: number): string => {
    if (value >= 80) return '#10B981'; // Green - high authenticity
    if (value >= 60) return '#F59E0B'; // Yellow - moderate authenticity  
    if (value >= 30) return '#EF4444'; // Red - low authenticity
    return '#7C2D12'; // Dark red - corrupted
  };

  /**
   * Gets status text for authenticity level
   */
  const getAuthenticityStatus = (value: number): string => {
    if (value >= 90) return 'Highly Authentic';
    if (value >= 75) return 'Authentic';
    if (value >= 50) return 'Moderately Consistent';
    if (value >= 25) return 'Inconsistent';
    return 'Severely Compromised';
  };

  // =============================================================================
  // PLAYER STATS COMPONENT
  // =============================================================================

  /**
   * Displays player's core attributes
   * Design: Kingdom Hearts trinity system with Mörk Borg brutal scaling
   */
  const PlayerStats: React.FC<{ player: PlayerState }> = ({ player }) => {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Character Stats</h3>

        {/* Core Trinity Stats */}
        <div className="space-y-3">
          <StatBar
            icon={<Sword size={16} />}
            label="Body"
            value={player.body}
            max={20}
            color="#DC2626"
            description="Physical prowess and combat effectiveness"
          />
          <StatBar
            icon={<Brain size={16} />}
            label="Mind"
            value={player.mind}
            max={20}
            color="#2563EB"
            description="Intellectual resilience and logical reasoning"
          />
          <StatBar
            icon={<Heart size={16} />}
            label="Heart"
            value={player.heart}
            max={20}
            color="#7C3AED"
            description="Spiritual integrity and moral strength"
          />
        </div>

        {/* Health and Experience */}
        <div className="mt-4 pt-4 border-t border-gray-600">
          <div className="flex justify-between text-sm">
            <span>HP: {player.hitPoints}/{player.maxHitPoints}</span>
            <span>XP: {player.experience}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Level {player.level}</span>
            <span className="capitalize">{player.philosophicalAlignment}</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Individual stat bar component
   * Design: Visual representation of character attributes with educational tooltips
   */
  const StatBar: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number;
    max: number;
    color: string;
    description: string;
  }> = ({ icon, label, value, max, color, description }) => {
    return (
      <div className="group relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-sm">{value}/{max}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(value / max) * 100}%`,
              backgroundColor: color
            }}
          />
        </div>

        {/* Tooltip with educational content */}
        <div className="absolute invisible group-hover:visible bg-gray-700 text-xs p-2 rounded mt-1 z-10 w-48">
          {description}
        </div>
      </div>
    );
  };

  // =============================================================================
  // EQUIPPED FALLACIES DISPLAY
  // =============================================================================

  /**
   * Shows currently equipped logical fallacies (player's "weapons")
   * Design: Strategic loadout system with educational descriptions
   */
  const EquippedFallacies: React.FC<{ player: PlayerState }> = ({ player }) => {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <Shield className="mr-2" size={20} />
          Equipped Fallacies
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((slot) => {
            const equippedFallacy = player.equippedFallacies[slot];
            return (
              <div
                key={slot}
                className={`border-2 border-dashed p-3 rounded ${equippedFallacy ? 'border-blue-500 bg-blue-900' : 'border-gray-600 bg-gray-700'
                  }`}
              >
                {equippedFallacy ? (
                  <div>
                    <p className="text-xs font-medium">{equippedFallacy.fallacyType}</p>
                    <p className="text-xs text-gray-300">DMG: {equippedFallacy.damage}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Empty Slot</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          Equip fallacies to defend against enemy arguments. Each type counters specific logical flaws.
        </p>
      </div>
    );
  };

  // =============================================================================
  // BOTTOM HOTBAR COMPONENT
  // =============================================================================

  /**
   * Bottom hotbar for quick access to items and abilities
   * Design: MMO-style hotbar adapted for philosophical tools
   */
  const PlayerHotbar: React.FC<{ player: PlayerState }> = ({ player }) => {
    return (
      <div className="flex items-center space-x-4">
        {/* Health/Mana Display */}
        <div className="flex items-center space-x-2">
          <Heart className="text-red-500" size={20} />
          <span className="text-sm">
            {player.hitPoints}/{player.maxHitPoints}
          </span>
        </div>

        {/* Item Slots */}
        <div className="flex space-x-2">
          {[0, 1, 2, 3, 4].map((slot) => {
            const item = player.inventory[slot];
            return (
              <div
                key={slot}
                className={`w-12 h-12 border-2 border-gray-600 rounded bg-gray-800 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors ${item ? 'bg-gray-700' : ''
                  }`}
                title={item ? `${item.name}: ${item.description}` : 'Empty slot'}
              >
                {item && (
                  <Package size={16} className="text-blue-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2">
          <button
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm transition-colors"
            onClick={() => setGamePhase('exploration')}
          >
            Explore
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm transition-colors"
            onClick={() => {
              // Would trigger random encounter
              setGamePhase('combat');
            }}
          >
            Seek Challenge
          </button>
        </div>
      </div>
    );
  };

  // =============================================================================
  // SCENARIO OVERLAY COMPONENT
  // =============================================================================

  /**
   * Overlay for philosophical scenario choices
   * Design: Clean, readable interface for complex moral decisions
   */
  const ScenarioOverlay: React.FC<{
    scenario: Scenario;
    onChoice: (choiceId: string) => void;
  }> = ({ scenario, onChoice }) => {
    return (
      <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-4xl max-h-96 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4">{scenario.title}</h2>

          <p className="text-gray-300 mb-6 leading-relaxed">
            {scenario.description}
          </p>

          <div className="space-y-3">
            {scenario.choices.map((choice) => (
              <button
                key={choice.choiceId}
                onClick={() => onChoice(choice.choiceId)}
                className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded transition-colors group"
              >
                <p className="font-medium mb-2">{choice.text}</p>
                <div className="flex items-center justify-between text-sm">
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: getAlignmentColor(choice.alignmentInfluence) + '33',
                      color: getAlignmentColor(choice.alignmentInfluence)
                    }}
                  >
                    {choice.alignmentInfluence}
                  </span>
                  <span className={choice.authenticityChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {choice.authenticityChange >= 0 ? '+' : ''}{choice.authenticityChange} Authenticity
                  </span>
                </div>

                {/* Educational reasoning - shows on hover */}
                <div className="mt-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {choice.reasoning}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-600">
            <p className="text-xs text-gray-400">
              <strong>Philosophical Basis:</strong> {scenario.philosophicalBasis}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // =============================================================================
  // COMBAT OVERLAY COMPONENT
  // =============================================================================

  /**
   * Overlay for logical combat encounters
   * Design: Educational interface teaching logical reasoning through combat
   */
  const CombatOverlay: React.FC<{
    enemy: Enemy;
    onSyllogismAnswer: (answer: boolean) => void;
  }> = ({ enemy, onSyllogismAnswer }) => {
    // Mock syllogism for demonstration - would be provided by backend
    const currentSyllogism = {
      premise1: "All social conventions are meaningless",
      premise2: "You follow social conventions",
      conclusion: "Therefore, you are meaningless",
      isValid: false,
      difficulty: 'Medium' as Difficulty
    };

    return (
      <div className="absolute inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-4xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Logical Combat</h2>
            <h3 className="text-xl mb-2">{enemy.name}</h3>
            <p className="text-sm text-gray-400">{enemy.historicalFigure}</p>
          </div>

          {/* Enemy Health */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>Enemy Health</span>
              <span>{enemy.hitPoints}/{enemy.maxHitPoints}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(enemy.hitPoints / enemy.maxHitPoints) * 100}%` }}
              />
            </div>
          </div>

          {/* Syllogism Challenge */}
          <div className="bg-gray-700 p-6 rounded mb-6">
            <h4 className="text-lg font-semibold mb-4">Evaluate This Logical Argument:</h4>

            <div className="space-y-3 mb-6">
              <div className="bg-gray-600 p-3 rounded">
                <span className="text-blue-300">Premise 1:</span> {currentSyllogism.premise1}
              </div>
              <div className="bg-gray-600 p-3 rounded">
                <span className="text-blue-300">Premise 2:</span> {currentSyllogism.premise2}
              </div>
              <div className="bg-gray-600 p-3 rounded">
                <span className="text-yellow-300">Conclusion:</span> {currentSyllogism.conclusion}
              </div>
            </div>

            <div className="text-center">
              <p className="mb-4">Is this argument logically valid?</p>
              <div className="space-x-4">
                <button
                  onClick={() => onSyllogismAnswer(true)}
                  className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-medium transition-colors"
                >
                  Valid
                </button>
                <button
                  onClick={() => onSyllogismAnswer(false)}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded font-medium transition-colors"
                >
                  Invalid
                </button>
              </div>
            </div>
          </div>

          {/* Educational Context */}
          <div className="bg-gray-700 p-4 rounded">
            <h5 className="font-medium mb-2">About {enemy.name}:</h5>
            <p className="text-sm text-gray-300 mb-2">{enemy.lore}</p>
            <p className="text-xs text-gray-400">
              <strong>Represents:</strong> {enemy.representedFlaw} fallacy
            </p>
          </div>

          {/* Combat Result Display */}
          {lastCombatResult && (
            <div className="mt-4 p-4 bg-gray-600 rounded">
              <h5 className="font-medium mb-2">
                {lastCombatResult.success ? 'Success!' : 'Failed!'}
              </h5>
              <p className="text-sm text-gray-300">{lastCombatResult.explanation}</p>
              {lastCombatResult.experienceGained > 0 && (
                <p className="text-xs text-green-400 mt-2">
                  +{lastCombatResult.experienceGained} XP gained
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============================================================================
  // GAME PHASE MANAGEMENT
  // =============================================================================

  /**
   * Handles keyboard input for game navigation
   * Design: Simple controls for exploration and interaction
   */
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!playerState) return;

      switch (event.key.toLowerCase()) {
        case ' ': // Spacebar - continue journey/random encounter
          if (gamePhase === 'exploration') {
            // Random chance of encounter
            if (Math.random() < 0.3) {
              setCurrentEnemy({
                enemyId: 'ghost_diogenes',
                name: 'Ghost of Diogenes the Cynic',
                historicalFigure: 'Diogenes of Sinope (c. 412-323 BCE)',
                representedFlaw: 'AdHominem',
                hitPoints: 25,
                maxHitPoints: 25,
                weakness: 'AdHominem',
                lore: 'Ancient Greek philosopher known for rejecting social conventions through provocative behavior. In undeath, his valid criticism of society has degraded into mere personal attacks without philosophical substance.'
              });
              setGamePhase('combat');
            } else {
              // Random scenario encounter
              setCurrentScenario({
                scenarioId: 'trolley_problem',
                title: 'The Trolley Problem',
                description: 'A runaway trolley is heading toward five people tied to the tracks. You can pull a lever to divert it to a side track, where it will kill one person instead. Do you pull the lever?',
                choices: [
                  {
                    choiceId: 'pull_lever',
                    text: 'Pull the lever - save five lives by sacrificing one',
                    alignmentInfluence: 'Utilitarian',
                    authenticityChange: 5.0,
                    reasoning: 'Utilitarian calculus: greatest good for greatest number justifies action'
                  },
                  {
                    choiceId: 'dont_pull',
                    text: "Don't pull the lever - refuse to directly cause someone's death",
                    alignmentInfluence: 'Existentialist',
                    authenticityChange: 3.0,
                    reasoning: 'Existentialist emphasis on personal responsibility and authenticity of choice'
                  },
                  {
                    choiceId: 'walk_away',
                    text: 'Walk away - none of this matters anyway',
                    alignmentInfluence: 'Nihilist',
                    authenticityChange: 2.0,
                    reasoning: 'Nihilistic rejection of moral frameworks as meaningless constructs'
                  }
                ],
                philosophicalBasis: 'Classic thought experiment in utilitarian ethics, first introduced by philosopher Philippa Foot in 1967'
              });
              setGamePhase('scenario');
            }
          }
          break;

        case 'e': // Examine surroundings
          if (gamePhase === 'exploration') {
            // Show environment details
            console.log('Examining surroundings...');
          }
          break;

        case 'escape': // Exit overlays
          if (gamePhase === 'scenario' || gamePhase === 'combat') {
            setCurrentScenario(null);
            setCurrentEnemy(null);
            setGamePhase('exploration');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gamePhase, playerState]);

  // =============================================================================
  // TEMPTATION ENCOUNTER COMPONENT
  // =============================================================================

  /**
   * Component for demon temptation encounters
   * Design: Presents moral choices with clear consequences
   * Note: Framed as educational examples showing negative effects of moral compromise
   */
  const TemptationEncounter: React.FC<{
    demon: {
      name: string;
      offer: string;
      literaryReference: string;
      philosophicalConcept: string;
    };
    onAccept: () => void;
    onReject: () => void;
  }> = ({ demon, onAccept, onReject }) => {
    return (
      <div className="absolute inset-0 bg-purple-900 bg-opacity-90 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-3xl border-2 border-purple-500">
          <h2 className="text-2xl font-bold text-purple-300 mb-4 text-center">
            {demon.name}
          </h2>

          <div className="bg-gray-700 p-6 rounded mb-6">
            <p className="text-lg italic mb-4">"{demon.offer}"</p>
          </div>

          {/* Educational Warning */}
          <div className="bg-yellow-900 border border-yellow-600 p-4 rounded mb-6">
            <h4 className="text-yellow-300 font-semibold mb-2">⚠ Philosophical Context</h4>
            <p className="text-sm text-yellow-100 mb-2">
              <strong>Literary Reference:</strong> {demon.literaryReference}
            </p>
            <p className="text-sm text-yellow-100">
              <strong>Concept:</strong> {demon.philosophicalConcept}
            </p>
          </div>

          <div className="flex space-x-4 justify-center">
            <button
              onClick={onReject}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded font-medium transition-colors"
            >
              Reject Temptation
            </button>
            <button
              onClick={onAccept}
              className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded font-medium transition-colors"
            >
              Accept Offer
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Warning: Acceptance will permanently affect your Authenticity Metric
          </p>
        </div>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER LOGIC
  // =============================================================================

  return (
    <div className="min-h-screen bg-gray-900">
      {gamePhase === 'character-creation' ? (
        <CharacterCreation />
      ) : (
        <GameInterface />
      )}
    </div>
  );
};

// =============================================================================
// UTILITY HOOKS AND FUNCTIONS
// =============================================================================

/**
 * Custom hook for managing game state synchronization with backend
 * Design: Ensures frontend state stays synchronized with authoritative backend state
 */
const useGameState = (playerId: string | null) => {
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPlayerState = useCallback(async () => {
    if (!playerId) return;

    setLoading(true);
    try {
      const state = await getPlayerState(playerId);
      setPlayerState(state);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    refreshPlayerState();
  }, [refreshPlayerState]);

  return { playerState, loading, error, refreshPlayerState };
};

/**
 * Custom hook for handling canvas animations
 * Design: Smooth animations for game world rendering
 */
const useCanvasAnimation = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const animationFrameRef = useRef<number>();

  const startAnimation = useCallback((renderFunction: () => void) => {
    const animate = () => {
      renderFunction();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  return { startAnimation, stopAnimation };
};

// =============================================================================
// GAME DEVELOPMENT UTILITIES
// =============================================================================

/**
 * Component for easy sprite replacement during development
 * Design: Allows quick swapping of visual assets without code changes
 */
const SpriteRenderer: React.FC<{
  spriteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  customSpritePath?: string;
}> = ({ spriteId, x, y, width, height, ctx, customSpritePath }) => {
  useEffect(() => {
    const renderSprite = () => {
      if (customSpritePath) {
        // Load custom sprite if provided
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, width, height);
        };
        img.src = customSpritePath;
      } else {
        // Default geometric sprite for development
        ctx.fillStyle = getSpriteColor(spriteId);
        ctx.fillRect(x, y, width, height);
      }
    };

    renderSprite();
  }, [spriteId, x, y, width, height, ctx, customSpritePath]);

  return null; // This component only renders to canvas
};

/**
 * Gets default color for sprite IDs during development
 * Design: Color-coded system for easy visual identification of game elements
 */
const getSpriteColor = (spriteId: string): string => {
  switch (spriteId) {
    case 'player': return '#4CAF50';
    case 'enemy_diogenes': return '#FF5722';
    case 'enemy_locke': return '#FF9800';
    case 'item_ring': return '#FFD700';
    case 'item_crown': return '#8B0000';
    case 'demon_lilith': return '#9C27B0';
    case 'demon_succubus': return '#E91E63';
    default: return '#757575';
  }
};

// =============================================================================
// EDUCATIONAL TOOLTIPS AND HELP SYSTEM
// =============================================================================

/**
 * Educational tooltip component
 * Design: Provides philosophical context for game elements without breaking immersion
 */
const EducationalTooltip: React.FC<{
  title: string;
  content: string;
  source?: string;
  children: React.ReactNode;
}> = ({ title, content, source, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bg-gray-800 border border-gray-600 p-4 rounded-lg w-80 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          <h4 className="font-semibold text-blue-300 mb-2">{title}</h4>
          <p className="text-sm text-gray-300 mb-2">{content}</p>
          {source && (
            <p className="text-xs text-gray-400">
              <strong>Source:</strong> {source}
            </p>
          )}
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Help panel component
 * Design: Comprehensive guide to game mechanics and philosophical concepts
 */
const HelpPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg max-w-4xl max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Philosophical RPG Guide</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-300">Core Mechanics</h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Authenticity Metric:</strong> Your spiritual "hit points" measuring philosophical consistency (0-100)</p>
              <p><strong>Logical Combat:</strong> Battle enemies using syllogisms and fallacy identification</p>
              <p><strong>Moral Choices:</strong> Decisions affect your authenticity and determine your final ending</p>
              <p><strong>Equipment:</strong> Items have moral weight - powerful gear may corrupt your authenticity</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-green-300">Philosophical Alignments</h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Utilitarian:</strong> Focus on maximizing happiness for the greatest number</p>
              <p><strong>Existentialist:</strong> Create your own meaning through authentic choice</p>
              <p><strong>Nihilist:</strong> Acknowledge that existence has no inherent meaning</p>
              <p><strong>Undecided:</strong> Discover your philosophy through gameplay choices</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-red-300">Combat System</h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Syllogisms:</strong> Evaluate logical arguments for validity (True/False)</p>
              <p><strong>Fallacies:</strong> Identify flawed reasoning patterns in enemy arguments</p>
              <p><strong>Strategy:</strong> Each enemy type has specific weaknesses and attack patterns</p>
              <p><strong>Learning:</strong> Combat teaches real philosophical concepts through practice</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DEVELOPMENT AND DEBUGGING COMPONENTS
// =============================================================================

/**
 * Development panel for testing different game states
 * Design: Quick access to different scenarios and player states for development
 */
const DevPanel: React.FC<{
  player: PlayerState | null;
  onStateChange: (newState: PlayerState) => void;
}> = ({ player, onStateChange }) => {
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Only show in development environment (detect by hostname or other browser-available method)
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isDevelopment || !player) return null;

  const quickTestStates = [
    {
      name: 'High Authenticity Utilitarian',
      modifications: {
        philosophicalAlignment: 'Utilitarian' as PhilosophicalAlignment,
        authenticityMetric: { ...player.authenticityMetric, value: 95.0 }
      }
    },
    {
      name: 'Corrupted Nihilist',
      modifications: {
        philosophicalAlignment: 'Nihilist' as PhilosophicalAlignment,
        authenticityMetric: {
          ...player.authenticityMetric,
          value: 25.0,
          permanentMarkers: ['Hypocrite', 'Hedonist'] as PermanentMarker[]
        }
      }
    },
    {
      name: 'Conflicted Existentialist',
      modifications: {
        philosophicalAlignment: 'Existentialist' as PhilosophicalAlignment,
        authenticityMetric: { ...player.authenticityMetric, value: 60.0 }
      }
    }
  ];

  if (!showDevPanel) {
    return (
      <button
        onClick={() => setShowDevPanel(true)}
        className="fixed top-4 left-4 bg-purple-600 text-white px-3 py-1 rounded text-xs"
      >
        Dev Panel
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-gray-800 border border-gray-600 p-4 rounded-lg w-64">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Development Panel</h3>
        <button
          onClick={() => setShowDevPanel(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Quick Test States:</h4>
        {quickTestStates.map((testState, idx) => (
          <button
            key={idx}
            onClick={() => onStateChange({ ...player, ...testState.modifications })}
            className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
          >
            {testState.name}
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-600">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Current State:</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Alignment: {player.philosophicalAlignment}</p>
          <p>Authenticity: {player.authenticityMetric.value.toFixed(1)}</p>
          <p>Markers: {player.authenticityMetric.permanentMarkers.join(', ') || 'None'}</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN EXPORT AND APP INITIALIZATION
// =============================================================================

/**
 * App wrapper with error boundary and global state management
 * Design: Robust error handling and development utilities
 */
const Game: React.FC = () => {
  const [gameState, setGameState] = useState<{
    player: PlayerState | null;
    currentPhase: string;
    error: string | null;
  }>({
    player: null,
    currentPhase: 'character-creation',
    error: null
  });

  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="relative">
      {/* Help Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded z-40 transition-colors"
      >
        Help & Guide
      </button>

      {/* Main Game */}
      <PhilosophicalRPG />

      {/* Help Panel */}
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Development Panel */}
      <DevPanel
        player={gameState.player}
        onStateChange={(newState) => setGameState(prev => ({ ...prev, player: newState }))}
      />

      {/* Error Display */}
      {gameState.error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg max-w-sm">
          <h4 className="font-semibold mb-2">Error</h4>
          <p className="text-sm">{gameState.error}</p>
          <button
            onClick={() => setGameState(prev => ({ ...prev, error: null }))}
            className="mt-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default Game